"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { LANG_INFO } from "@/lib/tr";
import { createPortal } from "react-dom";
import { supabaseBrowser } from "@/lib/supabase/client";
import { CountUp, Delta, Empty, Info, Spark, chColor, compact, fmt, pct } from "./charts";
import { LANG_LAND, SignatureLine, type Tone } from "./visuals";

export type D = Record<string, any>;

export type Tab = "more" | "home" | "alerts" | "goals" | "connect" | "retention" | "markets" | "stores" | "traffic" | "social" | "search" | "links" | "funnel" | "users" | "viral" | "product" | "system" | "live" | "inbox" | "planner" | "audience" | "ask" | "report" | "youtube" | "impressions" | "seo" | "brand" | "monitor" | "platforms" | "glossary" | "announce" | "audit" | "inkage";


export const GOAL = 1_000_000;

export const PERIODS: { d: number; l: string }[] = [{ d: 1, l: "24 óra" }, { d: 3, l: "3 nap" }, { d: 7, l: "7 nap" }, { d: 30, l: "30 nap" }, { d: 90, l: "90 nap" }, { d: 0, l: "Összes" }];


/* Local design preview only (npm run dev, /admin?mock): sample data instead of the database. Compiled out of production. */
export const MOCK = process.env.NODE_ENV !== "production" && typeof window !== "undefined" && new URLSearchParams(window.location.search).has("mock");

export async function rpc(sb: ReturnType<typeof supabaseBrowser>, fn: string, args?: Record<string, unknown>): Promise<{ data: any; error: { message: string; code?: string } | null }> {
  if (process.env.NODE_ENV !== "production" && MOCK) { const m = await import("./mock"); return { data: m.mock(fn, args || {}), error: null }; }
  if (!sb) return { data: null, error: { message: "Nincs adatbázis-kapcsolat." } };
  const { data, error } = await sb.rpc(fn, args);
  return { data, error: error ? { message: error.message, code: error.code } : null };
}

export async function api(path: string, init?: RequestInit) {
  if (process.env.NODE_ENV !== "production" && MOCK) { const m = await import("./mock"); return m.mockApi(path); }
  /* InkAge keeps the sign-in in the browser (not in cookies): the owner's token goes with every /api/admin call */
  const h = new Headers(init?.headers); if (!h.has("authorization")) { const tok = (await supabaseBrowser()?.auth.getSession())?.data.session?.access_token; if (tok) h.set("authorization", "Bearer " + tok); }
  const r = await fetch(path, { ...init, headers: h }); return { ok: r.ok, json: await r.json().catch(() => ({})) };
}


/* Which keys are set (yes / no only, from /api/admin/status "keys"), read once per page load. An empty card that needs a key
   says which one exactly, with a link to Kapcsolatok; once every key it names is set, the note disappears. */
let KEYS_P: Promise<Record<string, boolean> | null> | null = null;
export function useKeys() {
  const [k, setK] = useState<Record<string, boolean> | null>(null);
  useEffect(() => { KEYS_P ||= api("/api/admin/status").then((r) => (r.ok && r.json?.keys ? (r.json.keys as Record<string, boolean>) : null)).catch(() => null); KEYS_P.then(setK); }, []);
  return k;
}
export function NeedKey({ k, what }: { k: string | string[]; what?: string }) {
  const keys = useKeys(); const list = Array.isArray(k) ? k : [k];
  const missing = keys ? list.filter((x) => !keys[x]) : list;
  if (keys && !missing.length) return null;
  return <p className="note" style={{ marginTop: 8 }}>{keys ? "Hiányzó kulcs" : "Ehhez kell"}: {missing.map((x, i) => <span key={x}>{i ? ", " : ""}<code>{x}</code></span>)}{what ? ` (${what})` : ""} · <a className="lnk" href="#connect">Kapcsolatok →</a></p>;
}

/* ---------- labels ---------- */
/* InkAge's events reach the dashboard under the step names it counts (public.events_real): photo_added arrives as
   signature_captured, generate_done as flow_step "score", stage_y50 as reveal_shown, preview_saved as detail_open… The
   labels say what happened in InkAge; props.ev keeps InkAge's own name. */
export const EV: Record<string, string> = {
  monthly_limit: "Elérte a havi keretet", app_open: "App-képernyő", flow_step: "Lépés megtekintése", quiz_answer: "Bevezető kérdés válasza", quiz_start: "Bevezető kérdések indulnak",
  signature_captured: "Bőrfotó feltöltve", capture_skipped: "Fotó kihagyva", analysis_start: "Előnézet készül", score_shown: "Előnézet kész",
  reveal_shown: "Megnézte 50 év múlva", reveal_share: "Megosztó link", detail_open: "Előnézet elmentve", share_open: "Meghívó megosztva",
  share_save: "Mentés megosztásra", share_video: "Videó megosztva", client_error: "Hiba a böngészőben", server_error: "Hiba a szerveren", storage_full: "Tárhely megtelt",
  landing_view: "Weboldal-megtekintés", cta_click: "Gombkattintás", signup: "Regisztráció", auth_ok: "Sikeres belépés", auth_start: "Belépés indítva", auth_error: "Belépési hiba", signin_failed: "Sikertelen belépés",
  screen_time: "Képernyőn töltött idő", screenshot_key: "Képernyőkép-gomb (gépen)",
  gallery_open: "Galéria megnyitva", photo_check: "Fotó ellenőrizve", photo_pick_open: "Fotóválasztó megnyitva", design_pick_open: "Mintaválasztó megnyitva",
  design_added: "Minta kiválasztva", design_kind: "Mintatípus választva", tattoo_pick: "Meglévő tetoválás kijelölve", extract_design: "Minta kivágása fotóról", extract_done: "Minta kivágva",
  generate_error: "Előnézet nem sikerült", consent_all: "Elfogadta a statisztikát", onboarding_done: "Bevezető kérdések kész", nav_signin: "Belépés gomb",
  kb_open: "Tudástár-cikk", idea_saved: "Ötlet elmentve", idea_open: "Ötlet megnyitva", idea_try: "Ötlet kipróbálva", job_recovered: "Félbemaradt előnézet visszatöltve",
  explore_design: "Minta a böngészőből", lang_pick: "Nyelvválasztás", vote: "Szavazat", age_ok: "Életkor megerősítve", faq_open: "GYIK megnyitva", qf_open: "Gyorstipp megnyitva",
  removal_start: "Eltávolítás-szimuláció", ai_consent_yes: "MI-hozzájárulás megadva", aging_start: "Öregítés indul", card_made: "Kártya készült", redo: "Újrakezdte",
  uv_check: "UV-ellenőrzés", model_photo: "Modellfotó választva", ai_design: "MI-minta készült", auth_reset_request: "Jelszó-visszaállítás kérve", share_view: "Megosztott előnézet megnézve",
  landing_faq: "GYIK a főoldalon", landing_usecase: "Felhasználási példa", landing_compare: "Összehasonlítás", drawer_feature: "Menüpont", design_fav: "Kedvenc minta", save_image: "Kép mentve", upload_reuse: "Korábbi feltöltés újra",
  oauth_start: "Google/Apple-belépés indul (app)", oauth_back: "Visszaért a belépésből (app)", oauth_cancel: "Belépés félbehagyva (app)", iab_escape: "Instagram/TikTok → telefon böngészője", improve_start: "Javítás indul", resize: "Méret állítva", aftercare_ics: "Ápolási naptár", stage_y10: "Megnézte 10 év múlva", stage_y30: "Megnézte 30 év múlva",
  pro_file: "Fájl letöltve (PDF, videó, kép)", more_designs: "Új előnézetet kért („Nem lett jó?”)", signin: "Sikeres belépés", signup_confirmed: "Regisztráció megerősítve",
  server_error_unverified: "Szerverhiba (nem hitelesített)", artist_pdf: "PDF a tetoválóművésznek", video_made: "Öregedés-videó letöltve",
};

export const ev = (k: string) => EV[k] || k;

/* a quiz / placement answer as the person saw it: the body map's "@front:101,117|" coordinates left out; empty = "nem válaszolt" */
export const cleanAns = (v: unknown) => { const t = String(v ?? "").replace(/^@[a-z]+:[0-9.,-]*\|/i, "").trim(); return t || "nem válaszolt"; };

/* a sent phone notification that no device could receive (admin_push_status: "devices" = subscriptions at that time) */
export const PushNone = ({ x }: { x: D }) => (x && x.devices === 0 ? <em className="chip bad" style={{ fontStyle: "normal" }}>0 eszközre ment – senki nem kapta meg</em> : null);

export const HIDDEN = new Set(["paywall_shown", "plan_pick", "purchase"]); /* the app is free: older test events stay hidden */

export const ERRS = new Set(["client_error", "storage_full", "signin_failed", "auth_error"]);

export const FUNNEL: Record<string, [string, string]> = {
  sessions: ["Látogatás", "minden munkamenet"], land: ["Weboldalt látta", "főoldal, cikkek"], cta: ["Gombra kattintott", "kezdés, belépés"],
  app: ["Megnyitotta az appot", "/app betöltve"], named: ["Elkezdte", "fotóválasztó megnyitva"], captured: ["Feltöltött egy bőrfotót", "kihagyás nélkül"],
  scored: ["Megkapta az előnézetet", "a fő élmény"], quiz: ["Bevezető kérdések", "cél, stílus, testrész"], revealed: ["Megnézte 50 év múlva", "az öregedés"],
  detail: ["Elmentette az előnézetet", "a galériába"], shared: ["Megosztott", "megosztó link, meghívó"],
};

export const PREVK: Record<string, string> = { app: "sessions", named: "app", captured: "named", scored: "captured", quiz: "scored", revealed: "quiz", detail: "revealed" };

export const CH: Record<string, string> = { androidapp: "Android-app (Google Play)", tiktok: "TikTok", instagram: "Instagram", ig: "Instagram", facebook: "Facebook", fb: "Facebook", pinterest: "Pinterest", linkedin: "LinkedIn", li: "LinkedIn", google: "Google", youtube: "YouTube", snapchat: "Snapchat", email: "E-mail", ai: "MI-keresők (ChatGPT…)", közvetlen: "Közvetlen / ismeretlen", visszatérő: "Visszatérő látogató", kereső: "Más kereső", hivatkozás: "Más weboldal", link: "Rövid link", x: "X (Twitter)", threads: "Threads", reddit: "Reddit", whatsapp: "WhatsApp", messenger: "Messenger", telegram: "Telegram", bing: "Bing", play: "Google Play", ads: "Google Ads (fizetett)", ismeretlen: "Ismeretlen", iosapp: "iPhone-app (App Store)" };

export const ch = (k: string) => CH[k?.toLowerCase?.()] || k;

export const PROV: Record<string, string> = { email: "E-mail + jelszó", google: "Google", apple: "Apple" };

/* the languages InkAge really has, with their Hungarian names */
export const LANGS: Record<string, string> = Object.fromEntries(Object.entries(LANG_INFO).map(([k, v]) => [k, v.hu]));

export const lang = (k: string) => LANGS[(k || "?").slice(0, 2)] || k;

export const QSTEP: Record<string, string> = { name: "Fotó lépés", sign: "Minta lépés", style: "Stílus", goal: "Cél", placement: "Testrész" };

export const QVAL: Record<string, string> = { new: "Új tetoválást tervez", cover: "Takarást tervez", remove: "Eltávolítást fontolgat", existing: "Meglévőt néz", check: "Meglévőt ellenőriz",
  "fine-line": "Fine line", blackwork: "Blackwork", traditional: "Tradicionális", realism: "Realisztikus", watercolor: "Akvarell", minimal: "Minimal", lettering: "Felirat", geometric: "Geometrikus", tribal: "Tribal", dotwork: "Dotwork", japanese: "Japán",
  upload: "Saját feltöltés", library: "Mintatárból", ai: "MI-minta", photo: "Fotóról kivágva", camera: "Kamerával", file: "Fájlból", skipped: "Kihagyta",
  explore: "Csak nézelődik", another: "Másik", color: "Színes", other: "Egyéb", removal: "Eltávolítás", paste: "Beillesztve", link: "Linkről", idea: "Ötletből" };

/* the app's screens (screen_time.scr); InkAge does not send these yet */
export const SCR: Record<string, string> = { home: "Főoldal", gallery: "Galéria", result: "Eredmény", editor: "Szerkesztő" };


export const styleName = (v: unknown) => { const s = String(v || ""); if (!s) return "–"; return QVAL[s] || s; };

export const pageName = (p: unknown) => { const s = String(p || "/"); return ({ "/": "Főoldal", "/app": "App", "/regisztracio": "Regisztráció", "/belepes": "Belépés", "/gyik": "GYIK", "/rolunk": "Rólunk", "/funkciok": "Funkciók", "/hogyan-mukodik": "Hogyan működik", "/mi-az-inkage": "Mi az InkAge", "/tudastar": "Tudástár", "/telepites": "Telepítés", "/kapcsolat": "Kapcsolat", "/privacy": "Adatvédelem", "/terms": "Feltételek" } as Record<string, string>)[s] || (s.startsWith("/tudastar/") ? "Cikk: " + s.slice(10) : s.startsWith("/learn/") ? "Cikk: " + s.slice(7) : s.startsWith("/tattoo/") ? "Stílusoldal: " + s.slice(8) : s.startsWith("/go/") ? "Rövid link " + s : s.startsWith("/v/") ? "Megosztott előnézet" : s.startsWith("/app") ? "App" : s); };

export const SIGN: Record<string, string> = { upload: "Saját feltöltés", library: "Mintatárból", ai: "MI-minta", photo: "Fotóról kivágva", skipped: "Kihagyta" };

export const FILES: Record<string, string> = { pdf: "PDF a tetoválóművésznek", video: "Öregedés-videó", image: "Kép", ics: "Ápolási naptár" };

export const DOW = ["", "Hétfő", "Kedd", "Szerda", "Csütörtök", "Péntek", "Szombat", "Vasárnap"];

export const n = (x: any) => Number(x) || 0;

export const ago = (t?: string | null) => {
  if (!t) return "–";
  const s = (Date.now() - new Date(t).getTime()) / 1000;
  if (s < 60) return "most";
  if (s < 3600) return Math.floor(s / 60) + " perce";
  if (s < 86400) return Math.floor(s / 3600) + " órája";
  if (s < 86400 * 30) return Math.floor(s / 86400) + " napja";
  return new Date(t).toLocaleDateString("hu-HU", { year: "numeric", month: "short", day: "numeric" });
};

export const dt = (t?: string | null) => (t ? new Date(t).toLocaleString("hu-HU", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "–");

export const secs = (s?: number | null) => (s == null ? "–" : s < 90 ? fmt(s) + " mp" : s < 5400 ? fmt(s / 60, 1) + " perc" : fmt(s / 3600, 1) + " óra");


/* ---------- icons (1.7px strokes, 24px grid) ---------- */
export const P = {
  home: "M3 11.5 12 4l9 7.5M5.5 10v10h13V10M10 20v-5h4v5", traffic: "M3 17l6-6 4 4 8-8M15 7h6v6", social: "M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16M21 21l-4.3-4.3", links: "M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1",
  funnel: "M3 4h18l-7 8.5V19l-4 2v-8.5z", users: "M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 19v-1a4 4 0 0 0-3-3.9M16 2.1a4 4 0 0 1 0 7.8",
  viral: "M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6M6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6M8.6 13.5l6.8 4M15.4 6.5l-6.8 4",
  product: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z", system: "M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0",
  live: "M2 12h4l3-9 6 18 3-9h4", eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6", pen: "M3 21l3.5-1 11-11-2.5-2.5-11 11zM14.5 5.5l2.5 2.5M3 21h18",
  user: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8", share: "M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M16 6l-4-4-4 4M12 2v13",
  refresh: "M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5", menu: "M4 7h16M4 12h16M4 17h16", spark: "M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M12 7v5l3 2", globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18",
  doc: "M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M8 13h8M8 17h5", alert: "M12 8v4M12 16h.01M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18",
  check: "M20 6 9 17l-5-5", arrow: "M5 12h14M13 6l6 6-6 6", target: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2",
  bolt: "M13 2 4 14h7l-1 8 9-12h-7z", mail: "M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM3 7l9 6 9-6", layers: "M12 2 2 7l10 5 10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
  calendar: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z", plus: "M12 5v14M5 12h14",
  bell: "M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0", sun: "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4",
  moon: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z", play: "M6 4.5v15l13-7.5z", chev: "M15 18l-6-6 6-6", chevr: "M9 18l6-6-6-6", down: "M6 9l6 6 6-6", x: "M18 6 6 18M6 6l12 12",
};

export const I = (d: string) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;

/* each area has its pastel: the icon pebble of the open page wears it */
export const GT: Record<string, Tone> = { Ma: "peach", "Növekedés": "sky", "Felhasználók": "pink", "Termék": "butter", "Működés": "lilac" };

export const NAV: { g: string; items: { k: Tab; l: string; i: string; d: string }[] }[] = [
  { g: "Ma", items: [
    { k: "home", l: "Áttekintés", i: P.home, d: "A legfontosabb számok egy helyen, az 1 milliós cél felé." },
    { k: "live", l: "Élő", i: P.live, d: "Ami most történik az oldalon és az appban." },
    { k: "alerts", l: "Jelzések", i: P.alert, d: "Minden figyelmeztetés és lehetőség, fontossági sorrendben." },
    { k: "inbox", l: "Postafiók", i: P.mail, d: "Kommentek, áruházi vélemények és a weboldalról írt üzenetek, válasszal innen." },
    { k: "ask", l: "Kérdezz", i: P.spark, d: "Kérdezz a számaidtól: az MI a saját adataidból válaszol." },
  ] },
  { g: "Felhasználók", items: [
    { k: "users", l: "Emberek", i: P.users, d: "Kik regisztráltak, honnan, és visszajönnek-e." },
    { k: "funnel", l: "Tölcsér", i: P.funnel, d: "Az út lépésről lépésre: hol esnek ki az emberek." },
    { k: "retention", l: "Megtartás", i: P.refresh, d: "Visszajönnek-e a regisztráltak: kohorszok és aktív fiókok." },
    { k: "announce", l: "Közlemények", i: P.bell, d: "Sáv az app tetején: új nyelv, javítás, karbantartás. Időzíthető, nyelvre és platformra célozható." },
  ] },
  { g: "Növekedés", items: [
    { k: "traffic", l: "Források", i: P.traffic, d: "Honnan jönnek a látogatók, és melyik csatorna hoz felhasználót." },
    { k: "impressions", l: "Megjelenések", i: P.eye, d: "Hányszor láttak minket a Google-ben, a közösségi oldalakon és az App Store-ban, és mi kapcsán." },
    { k: "social", l: "Tartalom", i: P.social, d: "Minden platform: a fiókjaid, a videóid és a posztjaid valódi számai." },
    { k: "platforms", l: "Platformok", i: P.layers, d: "A platformok egymás mellett: melyik mennyit ér, hány látogatót és regisztrációt hoz 1000 megtekintésenként." },
    { k: "planner", l: "Tervező", i: P.calendar, d: "Tartalomnaptár: a megjelent és a tervezett posztok, ötletek, rövid linkek." },
    { k: "audience", l: "Közönség", i: P.users, d: "Követők platformonként, demográfia, aktív órák, storyk." },
    { k: "youtube", l: "YouTube", i: P.play, d: "Shorts és videók: nézőmegtartás, forgalomforrás, közönség." },
    { k: "search", l: "Google és cikkek", i: P.search, d: "Search Console: keresések, cikkek, helyezések." },
    { k: "seo", l: "SEO-ellenőrzés", i: P.check, d: "A weboldal heti bejárása, kannibalizáció, kulcsszóötletek, Bing, versenytársak tartalmai." },
    { k: "brand", l: "Márka és MI", i: P.spark, d: "Említések a weben, ajánl-e minket az MI, versenytársak a közösségi oldalakon." },
    { k: "links", l: "Linkek", i: P.links, d: "Videónkénti rövid linkek: melyik videó hozott embert." },
    { k: "markets", l: "Piacok", i: P.globe, d: "Nyelvek és országok: hol nagy a piac, és hol konvertál jól." },
    { k: "stores", l: "Áruházak", i: P.layers, d: "App Store és Google Play: letöltések, értékelések, vélemények." },
  ] },
  { g: "Termék", items: [
    { k: "product", l: "Használat", i: P.product, d: "Mit csinálnak az appban, mit választanak." },
    { k: "viral", l: "Megosztás", i: P.viral, d: "Megosztják-e, és hoz-e új embert a megosztás." },
    { k: "inkage", l: "InkAge", i: P.spark, d: "Ami csak az InkAge-é: MI-előnézetek és költségük, napi korlát, MI-modellek, moderálás, visszajelzések, várólista." },
  ] },
  { g: "Működés", items: [
    { k: "connect", l: "Kapcsolatok", i: P.bolt, d: "Minden platform, áruház, kereső és MI bekötése: a kulcsok megadása, próbája, állapota, telefonról is." },
    { k: "goals", l: "Célok és napló", i: P.target, d: "Heti és havi célok, jegyzetek a grafikonokra, reggeli összefoglaló." },
    { k: "system", l: "Rendszer", i: P.system, d: "Beállítások és biztonság: állapot, belépések, értesítések, kulcsok, e-mail." },
    { k: "monitor", l: "Monitoring", i: P.live, d: "A működés: elérhetőség, időzített feladatok, lehúzások, hibacsoportok, kiadások, riasztások." },
    { k: "report", l: "Heti riport", i: P.doc, d: "A hét egy oldalon, PDF-be menthető." },
    { k: "glossary", l: "Szótár", i: P.doc, d: "Minden szám meghatározása egy helyen: mit számol, honnan jön, mennyire friss." },
    { k: "audit", l: "Napló", i: P.doc, d: "Minden admin-művelet: ki, mikor, mit csinált. Nem törölhető." },
  ] },
];

/* the phone's bottom bar: four sections and "+"; Növekedés and Emberek hold their pages as swipeable sub-tabs,
   everything else lives on the "Több" screen */
export type PSec = "ma" | "grow" | "people" | "more";

/* the same groups as the desktop menu: Közönség (followers on the platforms) belongs to Növekedés on both */
export const PSUB: Record<"grow" | "people", Tab[]> = { grow: ["traffic", "impressions", "social", "platforms", "planner", "audience", "youtube", "search", "seo", "brand", "links", "markets", "stores"], people: ["users", "funnel", "retention"] };

export const secOf = (t: Tab): PSec => (t === "home" ? "ma" : PSUB.grow.includes(t) ? "grow" : PSUB.people.includes(t) ? "people" : "more");

export const TABBAR: { k: PSec | "plus"; l: string; i: string; to: Tab }[] = [
  { k: "ma", l: "Ma", i: P.home, to: "home" }, { k: "grow", l: "Növekedés", i: P.traffic, to: "traffic" }, { k: "plus", l: "", i: P.plus, to: "home" },
  { k: "people", l: "Emberek", i: P.users, to: "users" }, { k: "more", l: "Több", i: P.menu, to: "more" },
];

/* "Kérdezz erről az oldalról": the question each page sends to Kérdezz */
export const ASKQ: Partial<Record<Tab, string>> = {
  home: "Mi a legfontosabb változás a számaimban ebben az időszakban, és mit tegyek most?", traffic: "Melyik csatorna hozza a legtöbb valódi felhasználót, és melyiknél esnek ki a legtöbben?",
  impressions: "Hol láttak minket a legtöbbször, és melyik megjelenésből lett a legtöbb látogató?", social: "Melyik posztom működött a legjobban, miért, és mit posztoljak legközelebb?",
  platforms: "Melyik platform ér a legtöbbet nekem, és hova tegyek több energiát?", audience: "Hogyan nő a közönségem platformonként, és ki a közönségem?",
  youtube: "Hogyan teljesítenek a YouTube-videóim és a Shortsaim?", search: "Melyik Google-keresésekben tudnék a leggyorsabban előrébb kerülni?", seo: "Mi a három legfontosabb SEO-javítás most?",
  markets: "Melyik nyelv vagy ország a legnagyobb lehetőség most?", stores: "Hogyan állnak a letöltések és az értékelések, és mit javítsak?", users: "Kik regisztráltak, honnan jöttek, és mi különbözteti meg őket?",
  funnel: "Hol esnek ki a legtöbben az úton, és mit javítsak először?", retention: "Visszajönnek-e a regisztráltak, és mi tartja meg őket?", product: "Mit használnak a legtöbbet az appban, és mit hagynak ki?",
  viral: "Megosztják-e az appot, és hoz-e új embert a megosztás?", links: "Melyik rövid link hozza a legtöbb embert?", alerts: "Melyik jelzéssel foglalkozzak először, és miért?" };
export const SHORT: Partial<Record<Tab, string>> = { platforms: "Platformok", seo: "SEO", brand: "Márka", impressions: "Megjelenés", search: "Google", traffic: "Források", social: "Tartalom", users: "Emberek", audience: "Közönség" };

export const ALL = [...NAV.flatMap((g) => g.items), { k: "more" as Tab, l: "Több", i: P.menu, d: "" }];


/* Global filters: a channel, a language, a custom date range. Every chart on every page follows them, they live in
   the address bar (a link brings the same view back), and clicking a slice or a row sets them (cross-filter). */
export type Flt = { ch?: string; lang?: string; from?: string; to?: string };

export const FltCtx = createContext<{ f: Flt; set: (p: Partial<Flt>) => void }>({ f: {}, set: () => {} });

export const useFlt = () => useContext(FltCtx);
/* the channel filter can hold several channels ("tiktok,instagram") */
export const chList = (s?: string) => (s ? s.split(",").filter(Boolean) : []);
export const chToggle = (s: string | undefined, k: string) => { const l = chList(s); const nx = l.includes(k) ? l.filter((x) => x !== k) : [...l, k]; return nx.length ? nx.join(",") : undefined; };

export const readFlt = (): Flt => { try { const q = new URLSearchParams(location.search); const o: Flt = {}; (["ch", "lang", "from", "to"] as const).forEach((k) => { const v = q.get(k); if (v) o[k] = v.slice(0, 40); }); return o; } catch { return {}; } };

export const writeFlt = (f: Flt) => { try { const q = new URLSearchParams(location.search); (["ch", "lang", "from", "to"] as const).forEach((k) => { if (f[k]) q.set(k, f[k]!); else q.delete(k); }); const qs = q.toString().replace(/=(&|$)/g, "$1"); history.replaceState(history.state, "", location.pathname + (qs ? "?" + qs : "") + location.hash); } catch {} };

/* the period lives in the address bar too (?p=7), so a link or a reload brings the same view back */
export const readPeriod = (): number | null => { try { const v = new URLSearchParams(location.search).get("p"); return v !== null && [0, 1, 3, 7, 30, 90].includes(Number(v)) ? Number(v) : null; } catch { return null; } };
export const writePeriod = (d: number) => { try { const q = new URLSearchParams(location.search); if (d === 30) q.delete("p"); else q.set("p", String(d)); const qs = q.toString().replace(/=(&|$)/g, "$1"); history.replaceState(history.state, "", location.pathname + (qs ? "?" + qs : "") + location.hash); } catch {} };

/* ---------- one period for every page ----------
   days: the choice (1, 3, 7, 30, 90, 0 = all); from / to: a range of her own. "eff" is what a page that counts in days
   gets: "Összes" is always 3650 days (the same everywhere), a range of her own the days from its first day to today. */
export type Period = { days: number; from?: string; to?: string; eff: number; p_from: string | null; p_to: string | null; label: string };
export const ALL_DAYS = 3650;
/* a day count as words: 3650 is "összes", 1 is "24 óra" (it read "3650 nap") */
export const daysLabel = (x: number) => (!x || x >= ALL_DAYS ? "összes" : x === 1 ? "24 óra" : x + " nap");
export function makePeriod(days: number, f: Flt): Period {
  const p_from = f.from ? new Date(f.from + "T00:00:00").toISOString() : null;
  /* the next midnight by the calendar (24 hours would be an hour off on a clock-change day) */
  const p_to = f.to ? (() => { const x = new Date(f.to + "T00:00:00"); x.setDate(x.getDate() + 1); return x.toISOString(); })() : null;
  const eff = f.from ? Math.max(1, Math.ceil((Date.now() - new Date(f.from + "T00:00:00").getTime()) / 864e5)) : days || ALL_DAYS;
  const label = f.from ? `${f.from.slice(5).replace("-", ".")} – ${(f.to || "ma").slice(5).replace("-", ".")}` : days === 0 ? "a kezdetek óta" : days === 1 ? "24 óra" : `${days} nap`;
  return { days, from: f.from, to: f.to, eff, p_from, p_to, label };
}
export const PeriodCtx = createContext<Period>(makePeriod(30, {}));
/* the period of the dashboard: { days, from, to, eff, p_from, p_to } for any page that wants it */
export const usePeriod = () => useContext(PeriodCtx);
/* a card's own period, when it should differ from the header's (kept in this browser per card): [days, the picker] */
export const CARD_DAYS: [number, string][] = [[7, "7 nap"], [30, "30 nap"], [90, "90 nap"], [365, "1 év"]];
export function useCardDays(key: string, def = 0) {
  const per = useContext(PeriodCtx);
  const [v, setV] = useState(0);
  useEffect(() => { try { setV(Number(localStorage.getItem("inkage.admin.cd." + key) || 0)); } catch {} }, [key]);
  const pick = (x: number) => { setV(x); try { if (x) localStorage.setItem("inkage.admin.cd." + key, String(x)); else localStorage.removeItem("inkage.admin.cd." + key); } catch {} };
  const days = v || def || per.eff;
  const ctl = <select className="adm-in sm cd-pick" value={v} onChange={(e) => pick(Number(e.target.value))} aria-label="A kártya saját időszaka" title="A kártya saját időszaka (a fejléc időszakától függetlenül)">
    <option value={0}>{def ? `Alap: ${def} nap` : "Mint a fejléc"}</option>{CARD_DAYS.map(([d, l]) => <option key={d} value={d}>{l}</option>)}</select>;
  return [days, ctl] as const;
}

/* a block's own period picker, so the period can be changed where the numbers are, not only at the top. "Mint fölül"
   by default (the header's period, a from–to range too) and not remembered: a block never quietly shows another
   period than the one it says. Gives the period (eff days, p_* args for the RPCs, label) and the picker. */
export function useBlockPeriod() {
  const top = useContext(PeriodCtx);
  const [v, setV] = useState(-1);
  const p: Period = v < 0 ? top : makePeriod(v, {});
  const args = { p_days: p.eff, p_from: p.p_from, p_to: p.p_to };
  /* for the readers that take a start time only (admin_viral): the block's own day count as a moment, fixed when it is picked */
  const fromIso = useMemo(() => (v < 0 ? null : v ? new Date(Date.now() - v * 864e5).toISOString() : new Date(0).toISOString()), [v]);
  const ctl = <select className="adm-in sm cd-pick" value={v} onChange={(e) => setV(Number(e.target.value))} aria-label="A blokk időszaka" title="Ennek a blokknak az időszaka; alapból ugyanaz, mint fölül">
    <option value={-1}>Mint fölül ({top.label})</option>{PERIODS.map((x) => <option key={x.d} value={x.d}>{x.d === 1 ? "24 óra" : x.d === 0 ? "Összes" : x.l}</option>)}</select>;
  return { p, args, ctl, own: v >= 0, fromIso };
}
/* a block with its own period: the page's numbers while it says "Mint fölül", its own request once another period is picked */
export function useBlockRpc(fn: string, extra: Record<string, unknown>, deps: unknown[], args?: (b: ReturnType<typeof useBlockPeriod>) => Record<string, unknown>) {
  const bp = useBlockPeriod();
  const q = useRpc(fn, { ...extra, ...(args ? args(bp) : bp.args) }, [bp.own, bp.args.p_days, bp.args.p_from, bp.args.p_to, bp.fromIso, ...deps], !bp.own);
  return { ...bp, q };
}
/* the period as words for a sentence: "az elmúlt 24 órában", "az elmúlt 7 napban", "a kezdetek óta", "10.01 – 10.20" */
export const periodWords = (p: Period) => (p.from ? p.label : !p.days || p.eff >= ALL_DAYS ? "a kezdetek óta" : p.days === 1 ? "az elmúlt 24 órában" : `az elmúlt ${p.days} napban`);

/* ---------- one refresh for every card ----------
   The refresh button, pulling the page down and the automatic refresh raise this number; every useRpc reloads. */
export const RefreshCtx = createContext(0);
export const useRefresh = () => useContext(RefreshCtx);

export function Loading() {
  return (
    <div className="g">
      <div className="ph-splash" aria-hidden="true"><SignatureLine text="InkAge" /></div>
      <div className="s12" style={{ display: "flex", flexDirection: "column", gap: 10, padding: "8px 4px" }}><div className="skel" style={{ height: 12, width: 140, borderRadius: 99 }} /><div className="skel" style={{ height: 46, width: "min(520px,80%)", borderRadius: 16 }} /></div>
      {["peach", "butter", "pink", "sky"].map((t) => <div key={t} className="skel s3" style={{ height: 156, background: `var(--t-${t})`, opacity: .55 }} />)}
      <div className="skel s5" style={{ height: 380 }} /><div className="skel s7" style={{ height: 380 }} />
    </div>
  );
}

/* Card v2: title with the explanation behind ⓘ (sub), an optional visible line (desc), tools on the right, a footer */
export function Card({ title, sub, desc, icon, right, children, className = "", foot, onClick, src }: { title: string; sub?: React.ReactNode; desc?: React.ReactNode; icon?: string; right?: React.ReactNode; children: React.ReactNode; className?: string; foot?: React.ReactNode; onClick?: () => void; src?: string | string[] }) {
  const tip = sub || desc; /* minimal text: every explanation lives behind ⓘ */
  return (
    <section className={"c " + className + (onClick ? " click" : "")} onClick={onClick}>
      <div className="c-h">
        <div>{icon && <span className="c-ic">{I(icon)}</span>}<div><h2>{title}{tip && <Info>{tip}</Info>}</h2>{src && <div className="c-fresh">{(Array.isArray(src) ? src : [src]).map((x) => <Fresh key={x} src={x} />)}</div>}</div></div>
        {right && <div className="c-tools">{right}</div>}
      </div>
      {children}
      {foot && <div className="c-foot">{foot}</div>}
    </section>
  );
}

/* KPI v2: the number counts up, ⓘ carries the definition, the tile opens its page when it has one */
/* KPI = a pastel tile: icon pebble, LABEL, a big mono number, the change, a faint trend behind */
/* where a KPI leads (drill-down): a page ("users"), a card on this page by the start of its title ("@Vélemények"), or
   the next card below it ("@next") — the list behind the number */
export function drillTo(to: string, from?: HTMLElement | null) {
  if (!to.startsWith("@")) { location.hash = to; return; }
  const cards = Array.from(document.querySelectorAll<HTMLElement>(".adm-page section.c"));
  let el: HTMLElement | undefined;
  if (to === "@next") { const me = from?.getBoundingClientRect().top ?? 0; el = cards.find((c) => !c.classList.contains("kpi") && c.getBoundingClientRect().top > me + 20); }
  else { const t = to.slice(1).toLowerCase(); el = cards.find((c) => (c.querySelector("h2")?.textContent || "").toLowerCase().startsWith(t)); }
  if (el) { el.scrollIntoView({ behavior: "smooth", block: "start" }); el.classList.add("flash"); setTimeout(() => el!.classList.remove("flash"), 1400); }
}
/* where a number comes from: the platform's API, our own measuring, an estimate, a platform export, typed in by hand */
export const SRCK: Record<string, [string, string]> = { api: ["API", "A platform hivatalos adatai (API), automatikusan lehúzva."], own: ["saját mérés", "A inkage.app és az app névtelen méréséből, valós időben."],
  est: ["becslés", "Becsült szám: a forrását utólag, valószínűség alapján kötjük hozzá (pl. a fiókot a regisztráció előtti látogatáshoz)."], export: ["export", "A platform saját exportfájljából, amit feltöltöttél."], manual: ["kézi", "Kézzel beírt szám."] };
export function Kpi({ l, v, unit, now, prev, invert, spark, hl, sub, title, icon, className = "", onClick: oc, tone = "peach", to, kind }: { l: string; v: React.ReactNode; unit?: string; now?: number; prev?: number; invert?: boolean; spark?: number[]; hl?: boolean; sub?: React.ReactNode; title?: string; icon?: string; className?: string; color?: string; onClick?: () => void; tone?: Tone; to?: string; kind?: keyof typeof SRCK }) {
  const onClick = oc || (to ? (e?: React.MouseEvent<HTMLElement>) => drillTo(to, e?.currentTarget) : undefined);
  /* good or bad against the period before: a clear change (20 % or more) colours the tile's edge and says so */
  const ch = now != null && prev ? (now - prev) / prev : null, mood = ch == null || Math.abs(ch) < 0.2 ? "" : (ch > 0) !== !!invert ? " good" : " bad";
  return (
    <div className={`kpi t-${tone}` + mood + (hl ? " hl" : "") + (onClick ? " click" : "") + " " + className} onClick={onClick as any} role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined} title={to ? (to.startsWith("@") ? "Kattints: a részletek lent" : "Kattints: a részletek a saját oldalán") : undefined}>
      <span className="l"><span className="ki">{icon && I(icon)}</span><span className="kl">{l}{title && <Info>{title}</Info>}{kind && <span className={"skind " + kind} title={SRCK[kind][1]}>{SRCK[kind][0]}</span>}</span></span>
      <span className="v">{v}{unit && <small>{unit}</small>}</span>
      <span className="s">{now != null && prev != null && <Delta now={now} prev={prev} invert={invert} />}{sub}</span>
      {mood && <span className="kpi-say">{mood === " good" ? "jóval jobb, mint előtte" : "jóval gyengébb, mint előtte"}</span>}
      {spark && <Spark values={spark} h={44} color="var(--tile-ink)" />}
    </div>
  );
}

/* Table: click a header to sort (again to flip), CSV of exactly what is shown */
export function Tbl({ cols, rows, empty = "Még nincs adat ebben az időszakban.", onRow, name = "inkage", csv = true }: { cols: { k: string; l: string; num?: boolean; r?: (row: D) => React.ReactNode }[]; rows: D[]; empty?: string; onRow?: (r: D) => void; name?: string; csv?: boolean }) {
  const [sk, setSk] = useState<string | null>(null); const [dir, setDir] = useState<1 | -1>(-1);
  const sorted = useMemo(() => {
    if (!sk || !rows) return rows || [];
    const val = (r: D) => { const v = r[sk]; const x = typeof v === "number" ? v : Number(v); return v == null || v === "" ? -Infinity : Number.isFinite(x) && String(v).trim() !== "" && !/[a-zA-Z]/.test(String(v).replace(/e[+-]?\d+$/i, "")) ? x : String(v).toLowerCase(); };
    return [...rows].sort((a, b) => { const x = val(a), y = val(b); return (x < y ? -1 : x > y ? 1 : 0) * dir; });
  }, [rows, sk, dir]);
  if (!rows?.length) return <Empty t={empty} />;
  const sortBy = (k: string) => { if (sk === k) setDir(dir === 1 ? -1 : 1); else { setSk(k); setDir(-1); } };
  const download = () => {
    /* text from outside (a comment, a title) that starts like a formula is kept as text in Excel, never run */
    const esc = (v: unknown) => { let t = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v); if (typeof v === "string" && /^[=+\-@\t\r]/.test(t)) t = "'" + t; return /[";\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
    const use = cols.filter((c) => c.l && c.k !== "x" && c.k !== "thumb");
    const body = [use.map((c) => esc(c.l)).join(";"), ...sorted.map((r) => use.map((c) => esc(r[c.k])).join(";"))].join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["\ufeff" + body], { type: "text/csv;charset=utf-8" }));
    a.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  return (
    <div className="tw">
      {csv && <div className="tw-tools"><span>{fmt(rows.length)} sor</span><button className="lnk" onClick={download}>CSV ⤓</button></div>}
      <table className="tb cards">
        <thead><tr>{cols.map((c) => <th key={c.k} className={(c.num ? "num " : "") + (c.l ? "sortable" : "") + (sk === c.k ? " on" : "")} onClick={c.l ? () => sortBy(c.k) : undefined} aria-sort={sk === c.k ? (dir === 1 ? "ascending" : "descending") : undefined}>{c.l}{sk === c.k ? (dir === 1 ? " ↑" : " ↓") : ""}</th>)}</tr></thead>
        <tbody>{sorted.map((r, i) => <tr key={i} className={onRow ? "click" : ""} onClick={onRow ? () => onRow(r) : undefined}>{cols.map((c) => <td key={c.k} className={c.num ? "num" : ""} data-l={c.l}>{c.r ? c.r(r) : r[c.k] ?? "–"}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

export function Mini({ l, v, sub }: { l: string; v: any; sub?: React.ReactNode }) {
  return <div className="mini"><span>{l}</span><b>{typeof v === "number" || v == null ? fmt(n(v)) : v}</b>{sub && <small>{sub}</small>}</div>;
}

/* Hero band: the one number this page is about, its change, one plain sentence, and a side panel */
export function Band({ label, value, d = 0, unit, now, prev, invert, sentence, side, plain, sig, className = "s12", fmtFn }: { label: string; value: number; d?: number; unit?: string; now?: number; prev?: number; invert?: boolean; sentence?: React.ReactNode; side?: React.ReactNode; plain?: boolean; sig?: boolean; className?: string; fmtFn?: (x: number) => string }) {
  return (
    <section className={"band " + (plain ? "plain " : "") + className}>
      {sig && <span className="band-stroke" aria-hidden="true" />}
      <div>
        <span className="lbl">{label}{sentence && <Info>{sentence}</Info>}</span>
        <div className="num"><b><CountUp v={value} d={d} fmtFn={fmtFn} /></b>{now != null && prev != null && <Delta now={now} prev={prev} invert={invert} />}{unit && <small>{unit}</small>}</div>
      </div>
      {side && <div className="side">{side}</div>}
    </section>
  );
}

export const pctCell = (a: number, b: number) => <span className="pct">{pct(a, b)}</span>;

export const barCell = (v: number, max: number, label?: React.ReactNode) => <span className="bar-c">{label ?? fmt(v)}<i style={{ width: Math.max(2, (v / Math.max(1, max)) * 70) }} /></span>;

export const periodName = (d: D) => (d.days > 365 ? "a kezdetek óta" : d.days === 1 ? "az elmúlt 24 órában" : `az elmúlt ${d.days} napban`);

export const series = (d: D, k: string) => (d.trend || []).map((x: D) => n(x[k]));

/* channels with their colour; "közvetlen" (no source) stays neutral grey */
export const chCol = (k: string) => chColor(k === "közvetlen" ? "" : k);

export const usefulDims = (rows: D[] = []) => rows.filter((r) => r.k && r.k !== "?").length > 0;


/* ---------- home ---------- */
/* the visitors' languages painted on the countries where they are spoken (an estimate: events keep no country) */
export const langLand = (langs: D[] = []) => { const v: Record<string, number> = {}; langs.forEach((l) => (LANG_LAND[String(l.k).slice(0, 2)] || []).forEach((c) => { v[c] = Math.max(v[c] || 0, n(l.n)); })); return v; };

export const TONE: Record<string, Tone> = { bad: "pink", warn: "butter", good: "mint", info: "sky" };


/* technical error texts in plain Hungarian; the original stays in the System page's table, under the line */
export const HUMAN: [RegExp, string][] = [
  [/scopes without modifying the main activity/i, "Az Android-app Google-belépése egy hiányzó beállítás miatt nem indul el"],
  [/popup.*(closed|blocked)|cancel+ed|user.?cancel/i, "A felhasználó bezárta a belépő ablakot"],
  [/invalid login credentials/i, "Hibás e-mail-cím vagy jelszó"],
  [/email not confirmed/i, "Az e-mail-cím még nincs megerősítve"],
  [/network|failed to fetch|timeout/i, "Hálózati hiba: nem volt internetkapcsolat"],
  [/rate limit|too many/i, "Túl sok próbálkozás rövid idő alatt"],
  [/quota|storage/i, "Megtelt a böngésző tárhelye"],
];

export const human = (m?: string | null) => { const t = String(m || ""); return HUMAN.find(([r]) => r.test(t))?.[1] || (/^[ -~\s]*$/.test(t) && t.length > 12 ? "Technikai hiba a böngészőben" : t || "Ismeretlen hiba"); };


/* ---------- freshness: when each source was last read ---------- */
export const FreshCtx = createContext<D | null>(null);
export function useFreshData(epoch = 0) {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [f, setF] = useState<D | null>(null);
  useEffect(() => {
    const load = () => rpc(sb, "admin_fresh").then(({ data }) => setF(data || null));
    load(); const t = setInterval(() => { if (document.visibilityState === "visible") load(); }, 60_000);
    return () => clearInterval(t);
  }, [sb, epoch]);
  return f;
}
export const SRC_L: Record<string, string> = { tiktok: "TikTok", instagram: "Instagram", facebook: "Facebook", pinterest: "Pinterest", linkedin: "LinkedIn", youtube: "YouTube", gsc: "Google", apple: "App Store", google: "Google Play",
  appstore: "App Store", googleplay: "Google Play", events: "Saját mérés", index: "Indexelés", gsc_index: "Indexelés", bing: "Bing", seo: "SEO-bejárás", watch: "Napi figyelés", aivis: "MI-láthatóság",
  cwv: "Oldalsebesség", competitors: "Versenytársak", mentions: "Említések", kw_ideas: "Kulcsszóötletek", cse: "Programmable Search" };
/* How long each source stays fresh: one table for the freshness row, the self-check and the alerts. The social
   platforms are read every hour (2 hours = one missed run); the daily runs get 30 hours; the weekly ones 8 days. */
export const FRESH_MAX: Record<string, number> = { social: 2 * 3600e3, gsc: 30 * 3600e3, apple: 30 * 3600e3, google: 30 * 3600e3, index: 30 * 3600e3, gsc_index: 30 * 3600e3,
  bing: 30 * 3600e3, watch: 30 * 3600e3, cwv: 30 * 3600e3, competitors: 30 * 3600e3, mentions: 30 * 3600e3, cse: 30 * 3600e3, seo: 8 * 864e5, aivis: 8 * 864e5, kw_ideas: 8 * 864e5 };
const RUN_SRC: Record<string, string> = { mentions: "watch", index: "gsc_index", appstore: "apple", googleplay: "google" };
/* the time a source was last read, and whether that is fresh for it (Google gives data 2–3 days late) */
export function freshOf(f: D | null, src: string): { at: string | null; ok: boolean; note?: string } {
  if (!f) return { at: null, ok: true };
  const fresh = (at: string | null, k: string, err = false) => !!at && !err && Date.now() - new Date(at).getTime() < (FRESH_MAX[k] ?? 30 * 3600e3);
  if (src === "gsc") return { at: f.gsc?.at || null, ok: fresh(f.gsc?.at || null, "gsc", !!f.gsc?.error),
    note: [f.gsc?.error ? "az utolsó lehúzás hibás volt" : "", f.gsc?.day ? `adat: ${new Date(f.gsc.day).toLocaleDateString("hu-HU", { month: "short", day: "numeric" })}-ig (a Google 2–3 nap késéssel ad)` : ""].filter(Boolean).join(" · ") || undefined };
  if (src === "events") return { at: f.events || null, ok: true };
  const s = RUN_SRC[src] || src;
  if (s === "apple" || s === "google") { const at = f[s] || null; return { at, ok: fresh(at, s) }; }
  if (s === "gsc_index" && f.index) return { at: f.index, ok: fresh(f.index, "index") };
  /* a run that worked but brought nothing, skipped a part or missed a source ("üres", "kihagyva", "részben") is not fresh */
  if (f.src?.[s]) { const x = f.src[s]; return { at: x.at || null, ok: fresh(x.at || null, s, !!x.error || !!x.empty),
    note: x.error ? "az utolsó futás hibás volt" : x.empty ? `lefutott, de nem jött teljes adat${x.note ? ": " + String(x.note).replace(/^.*?(üres:|részben:|kihagyva:?)\s*/i, "") : ""}` : src === "mentions" && f.mentions ? `utolsó említés: ${new Date(f.mentions).toLocaleDateString("hu-HU")}` : undefined }; }
  const p = f.platforms?.[src]; return { at: p?.at || null, ok: fresh(p?.at || null, "social", !!p?.error), note: p?.error ? "az utolsó lehúzás hibás volt" : undefined };
}
const hasSrc = (f: D, s: string) => s === "events" || s === "gsc" || !!f.platforms?.[s] || !!f[RUN_SRC[s] || s] || !!f.src?.[RUN_SRC[s] || s] || (s === "index" && !!f.index);
export function Fresh({ src }: { src: string }) {
  const f = useContext(FreshCtx), x = freshOf(f, src);
  if (!f || (!x.at && !hasSrc(f, src))) return null;
  return <span className={"fresh " + (x.ok ? "ok" : "old")} title={x.note || (x.at ? new Date(x.at).toLocaleString("hu-HU") : "még nem volt lehúzás")}><i />{SRC_L[src] || src}: {x.at ? ago(x.at) : "még nincs"}</span>;
}
/* one row under the page title: every source this page reads */
export function FreshRow({ srcs }: { srcs: string[] }) {
  const f = useContext(FreshCtx);
  if (!f) return null;
  const list = srcs.filter((s) => hasSrc(f, s));
  if (!list.length) return null;
  return <div className="s12 fresh-row">{list.map((s) => <Fresh key={s} src={s} />)}</div>;
}


/* the page's one lesson, in a sentence, at the top */
export function Lesson({ children }: { children: React.ReactNode }) {
  return <section className="lesson s12"><span className="ls-i">{I(P.pen)}</span><p>{children}</p></section>;
}


export type Alert = { c: "bad" | "warn" | "good" | "info"; t: string; s: string; to?: Tab };

/* every signal the numbers give, most urgent first (the Jelzések page shows all, the home page the top six) */
/* Errors already fixed in the app: shown as "javítva" with the date, and no longer raised as a signal unless they
   happen again after the fix. The owner can mark any other group solved too ("Megoldva", kept in this browser). */
export const FIXED: { re: RegExp; at: string; note: string }[] = [
  { re: /scopes without modifying the main activity/i, at: "2026-10-21T11:08:43Z", note: "javítva okt. 21-én" },
];
export const solvedKey = (x: D) => String(x.provider || x.name || "") + "|" + String(x.why || x.msg || "").slice(0, 80);
/* "Megoldva" lives in the database (admin_solved; the shell loads it once), so every device and the Monitoring
   page agree; this browser's older marks still count */
export const SOLVED: { map: Record<string, string> } = { map: {} };
export const solvedAt = (x: D): string | null => {
  const f = FIXED.find((r) => r.re.test(String(x.why || x.msg || "")));
  let mine: string | null = null; try { mine = JSON.parse(localStorage.getItem("inkage.admin.solved") || "{}")[solvedKey(x)] || null; } catch {}
  const at = [f?.at, mine, SOLVED.map[solvedKey(x)]].filter(Boolean).sort().pop() || null;
  return at && x.last && new Date(x.last) <= new Date(at) ? at : null;
};
export const markSolved = (x: D) => {
  const now = new Date().toISOString(); SOLVED.map[solvedKey(x)] = now;
  try { const m = JSON.parse(localStorage.getItem("inkage.admin.solved") || "{}"); m[solvedKey(x)] = now; localStorage.setItem("inkage.admin.solved", JSON.stringify(m)); } catch {}
  /* the database too: the key, and the Monitoring page's error groups of the same message are resolved with it */
  rpc(supabaseBrowser(), "admin_solved_set", { p_key: solvedKey(x), p_provider: x.provider ?? x.where ?? null, p_msg: x.why ?? x.msg ?? null }).catch(() => null);
};
export const fixNote = (x: D) => FIXED.find((r) => r.re.test(String(x.why || x.msg || "")))?.note || "megoldva";

/* the platforms' own signals (a broken connection, a page out of Google, a crash wave, a negative review), loaded with the dashboard */
export const PA: { list: Alert[] } = { list: [] };
export function alerts(d: D): Alert[] {
  const out: Alert[] = [...PA.list];
  const N = d.now || {}, PV = d.prev || {};
  const sf = ((d.signin_fail || []) as D[]).filter((x) => !solvedAt(x));
  if (sf.length) out.push({ c: "bad", t: `${fmt(sf.reduce((s, x) => s + n(x.n), 0))} sikertelen ${sf[0].provider === "google" ? "Google-" : ""}belépés`, s: `${human(sf[0].why)} · ${fmt(sf[0].sessions)} embernél`, to: "monitor" });
  if (n(d.live_now) > 0) out.push({ c: "good", t: `Most ${d.live_now} ember használja`, s: `Az elmúlt órában ${d.live_hour} látogatás.`, to: "live" });
  /* no change against a period that began before the first data (it is not "less", it was not measured) */
  if (!d.prev_partial && n(PV.sessions) >= 10 && n(N.sessions) > n(PV.sessions) * 1.5) out.push({ c: "good", t: "Forgalmi kiugrás", s: `${fmt(((n(N.sessions) - n(PV.sessions)) / n(PV.sessions)) * 100)}%-kal több látogatás, mint előtte.`, to: "traffic" });
  if (!d.prev_partial && n(PV.sessions) >= 10 && n(N.sessions) < n(PV.sessions) * 0.5) out.push({ c: "warn", t: "Visszaesett a forgalom", s: "Feleannyi látogatás sincs, mint az előző időszakban.", to: "traffic" });
  const f = d.funnel || [], val = (k: string) => n(f.find((x: D) => x.k === k)?.n);
  let worst: { a: string; b: string; r: number } | null = null;
  ["app", "named", "captured", "scored", "quiz", "revealed"].forEach((k, i, arr) => { if (!i) return; const a = val(arr[i - 1]), b = val(k); if (a >= 5 && (!worst || b / a < worst.r)) worst = { a: arr[i - 1], b: k, r: b / a }; });
  const w = worst as { a: string; b: string; r: number } | null;
  if (w && w.r < 0.8) out.push({ c: "warn", t: `Legnagyobb kiesés: ${FUNNEL[w.a][0].toLowerCase()} → ${FUNNEL[w.b][0].toLowerCase()}`, s: `Csak ${fmt(w.r * 100)}% megy tovább.`, to: "funnel" });
  const direct = n((d.channels || []).find((c: D) => c.k === "közvetlen")?.sessions);
  if (n(N.sessions) >= 20 && direct / n(N.sessions) > 0.6) out.push({ c: "info", t: `${pct(direct, n(N.sessions))} forrás nélkül érkezik`, s: "Tegyél inkage.app/go/… rövid linket minden videóba, és látni fogod, melyik hozta.", to: "links" });
  if (n(d.users?.unconfirmed) > 0) out.push({ c: "warn", t: `${d.users.unconfirmed} fiók nem erősítette meg az e-mailjét`, s: "Nem tudnak belépni. Nézd meg a levelek kézbesítését.", to: "users" });
  const cs = d.campaigns || [];
  if (cs.length) { const best = [...cs].sort((a: D, b: D) => n(b.scored) - n(a.scored))[0]; if (n(best.scored) > 0) out.push({ c: "good", t: `Legjobb jelölt link: ${ch(best.source)}${best.content !== "–" ? " · " + best.content : ""}`, s: `${fmt(best.sessions)} látogatás, ${fmt(best.scored)} előnézet.`, to: "traffic" }); }
  const N2 = d.now || {};
  /* the same rate as Áttekintés and Megosztás: sharers who got a preview, over those who got one */
  const ss2 = n(N2.scored_shared ?? N2.shared);
  if (n(N2.scored) >= 10 && ss2 / n(N2.scored) < 0.1) out.push({ c: "warn", t: "Kevesen osztják meg az eredményt", s: `${pct(ss2, n(N2.scored))} az előnézetet kapók közül; a cél 10% fölött.`, to: "viral" });
  const langs = (d.langs || []).filter((l: D) => n(l.n) >= 10).map((l: D) => ({ k: l.k, r: n(l.scored) / n(l.n) })).sort((a: D, b: D) => b.r - a.r);
  if (langs.length >= 2) out.push({ c: "info", t: `Legjobban konvertáló nyelv: ${lang(langs[0].k)}`, s: `${fmt(langs[0].r * 100)}% jut el az előnézetig; érdemes több videót erre a nyelvre.`, to: "markets" });
  /* (the iPhone app's missing usage data is a fixed fact, not a signal: it stays on the System page's "Adatok" card) */
  const order = { bad: 0, warn: 1, good: 2, info: 3 };
  /* every signal opens the page where it can be acted on: a failed sync or a scheduled job on Monitoring, a broken
     connection on Kapcsolatok; a duplicate (same title) is shown once */
  const seen = new Set<string>();
  return out.map((a) => (a.to === "system" && /lehúzás|futott|feladat|mérés/i.test(a.t) ? { ...a, to: "monitor" as Tab } : !a.to ? { ...a, to: "alerts" as Tab } : a))
    .filter((a) => (seen.has(a.t) ? false : (seen.add(a.t), true))).sort((a, b) => order[a.c] - order[b.c]);
}

export const AIC = { bad: P.alert, warn: P.alert, good: P.check, info: P.spark };


/* ---------- TikTok + Instagram ---------- */
export const PF: Record<string, string> = { tiktok: "TikTok", instagram: "Instagram", facebook: "Facebook", pinterest: "Pinterest", linkedin: "LinkedIn", youtube: "YouTube", bing: "Bing", google: "Google", appstore: "App Store", googleplay: "Google Play", apple: "App Store", play: "Google Play" };
export const SOC = ["tiktok", "instagram", "facebook", "pinterest", "linkedin", "youtube"] as const;

export const big = (x: any) => (x == null ? "–" : compact(n(x)));


/* a database error in plain words (an expired sign-in asks for a new one: the shell listens for it) */
export const errText = (m: string) => /PGRST202|could not find|does not exist/i.test(m) ? "Az adatbázis-frissítés még nincs telepítve."
  : /JWT|PGRST30[0-3]|expired|invalid claim/i.test(m) ? "Lejárt a belépés. Lépj be újra." : /forbidden|42501/.test(m) ? "Nincs jogosultság." : m;
export const EXPIRED = "inkage-admin-expired";

/* Budapest time, whatever the device's clock says: the day as "YYYY-MM-DD", and the weekday (1 = Monday … 7) and hour of a moment */
export const bpDate = (t: Date = new Date()) => t.toLocaleDateString("sv-SE", { timeZone: "Europe/Budapest" });
const BP_DOW: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
export function bpParts(t: Date) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Budapest", weekday: "short", hour: "numeric", hourCycle: "h23" }).formatToParts(t).map((x) => [x.type, x.value]));
  return { dow: BP_DOW[p.weekday] || 1, hour: Number(p.hour) || 0 };
}

/* One admin function's data. It reloads when its deps change and whenever the dashboard refreshes (the refresh
   button, pulling down, the automatic refresh), keeping the last numbers on screen meanwhile. Besides d / e / load
   it tells busy (a load is running) and at (when the data arrived). */
/* skip: do not ask (yet), e.g. when the same numbers are already loaded elsewhere on the page */
export function useRpc(fn: string, args: Record<string, unknown> | undefined, deps: unknown[], skip = false) {
  const sb = useMemo(() => supabaseBrowser(), []);
  const epoch = useContext(RefreshCtx);
  const [d, setD] = useState<D | null>(null); const [e, setE] = useState(""); const [busy, setBusy] = useState(false); const [at, setAt] = useState(0);
  /* only the newest request's answer counts: a slower answer for the period chosen before never overwrites it */
  const seq = useRef(0);
  const load = useCallback(async () => {
    const my = ++seq.current;
    setBusy(true);
    const { data, error } = await rpc(sb, fn, args);
    if (my !== seq.current) return;
    setBusy(false);
    if (error) { setE(errText(error.message + " " + (error.code || ""))); if (/JWT|PGRST30[0-3]|expired/i.test(error.message + (error.code || ""))) window.dispatchEvent(new Event(EXPIRED)); }
    else { setE(""); setD(data as D); setAt(Date.now()); }
  }, [sb, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!skip) load(); }, [load, epoch, skip]);
  return { d, e, load, busy, at };
}

/* ---------- one way to wait, fail and try again ----------
   The skeleton while the first load runs, the error with an "Újra" button when it fails (never an endless skeleton),
   then the content. q is what useRpc returned. */
export function Async({ q, h = 120, empty, children }: { q: { d: D | null; e: string; load: () => void; busy?: boolean }; h?: number; empty?: (d: D) => boolean; children: (d: D) => React.ReactNode }) {
  if (q.e && !q.d) return <StateErr msg={q.e} retry={q.load} busy={q.busy} />;
  if (!q.d) return <div className="skel" style={{ height: h }} aria-busy="true" />;
  if (empty?.(q.d)) return <Empty t="Még nincs adat." />;
  return <>{q.e && <StateErr msg={q.e} retry={q.load} busy={q.busy} small />}{children(q.d)}</>;
}
export function StateErr({ msg, retry, busy, small }: { msg: string; retry?: () => void; busy?: boolean; small?: boolean }) {
  return (
    <div className={"st-err" + (small ? " sm" : "")} role="alert">
      <span>{small ? "Az utolsó frissítés nem sikerült: " : "Nem sikerült betölteni: "}{msg}</span>
      {retry && <button className="adm-ibtn sm" onClick={retry} disabled={busy}>{busy ? "Töltés…" : "Újra"}</button>}
    </div>
  );
}


/* ---------- Google Search Console ---------- */
export const A3: Record<string, string> = { hun: "HU", usa: "US", gbr: "GB", deu: "DE", aut: "AT", che: "CH", fra: "FR", ita: "IT", esp: "ES", prt: "PT", nld: "NL", bel: "BE", pol: "PL", cze: "CZ", svk: "SK", rou: "RO", srb: "RS", hrv: "HR", svn: "SI", ukr: "UA", rus: "RU", tur: "TR", grc: "GR", fin: "FI", swe: "SE", nor: "NO", dnk: "DK", irl: "IE", can: "CA", mex: "MX", bra: "BR", arg: "AR", ind: "IN", idn: "ID", jpn: "JP", kor: "KR", chn: "CN", aus: "AU", sau: "SA", are: "AE", irn: "IR", egy: "EG", pak: "PK", phl: "PH", vnm: "VN", tha: "TH", mys: "MY", nga: "NG", zaf: "ZA" };

export const COUNTRY = (k: string) => { const a2 = A3[(k || "").toLowerCase()]; try { return a2 ? new Intl.DisplayNames(["hu"], { type: "region" }).of(a2) || k : (k || "?").toUpperCase(); } catch { return k; } };

export const DEV: Record<string, string> = { MOBILE: "Mobil", DESKTOP: "Számítógép", TABLET: "Tablet" };

export const short = (u: string) => { try { const x = new URL(u); return decodeURIComponent(x.pathname + x.search); } catch { return u; } };

export const posChip = (p: number) => <span className={"chip " + (p <= 3 ? "good" : p <= 10 ? "gold" : p <= 20 ? "warn" : "")}>{fmt(p, 1)}</span>;


/* ---------- goals and notes ---------- */
export const NOTE_KIND: Record<string, string> = { kiadas: "Kiadás", kampany: "Kampány", poszt: "Poszt", kulso: "Külső esemény", egyeb: "Jegyzet" };

export const GOAL_M: Record<string, string> = { scored: "Kész előnézet", sessions: "Látogatás", signups: "Regisztráció", shared: "Megosztás", gsc_clicks: "Google-kattintás", followers: "Követő (összes platform)",
  ...Object.fromEntries(([["tiktok", "TikTok"], ["instagram", "Instagram"], ["facebook", "Facebook"], ["pinterest", "Pinterest"], ["linkedin", "LinkedIn"], ["youtube", "YouTube"]] as const).flatMap(([p, nm]) => [[`followers_${p}`, `${nm}: követő`], [`views_${p}`, `${nm}: új megtekintés`], [`visits_${p}`, `${nm}: látogató`]])) };


/* ---------- detail panels: one post, one Google page ---------- */
/* the posts last loaded, so a post's sheet can compare it with the others on its platform */
export const POOL: { posts: D[] } = { posts: [] };


/* ---------- AI analysis ---------- */
/* only anonymous aggregates go out: no e-mails, names, live events or error texts */
export const aiSafe = (d: D) => { const { live, errors, users, error_groups, signin_fail, ...rest } = d || {}; void live; void errors; void error_groups; return { ...rest, users: users ? { providers: users.providers, langs: users.langs, active_7: users.active_7, active_30: users.active_30, unconfirmed: users.unconfirmed, cohorts: users.cohorts } : undefined, signin_fail: (signin_fail || []).map((x: D) => ({ provider: x.provider, n: x.n })) }; };

/* the one daily limit of every AI call on the dashboard (the server's DAILY_CAP in app/api/admin/ai) */
export const AI_DAILY = 120;

export function AiNote({ page, data }: { page: string; data: D }) {
  const [busy, setBusy] = useState(false); const [out, setOut] = useState<{ ok: boolean; t: string } | null>(null);
  const run = async () => {
    setBusy(true); setOut(null);
    try {
      if (MOCK) { await new Promise((r) => setTimeout(r, 600)); setOut({ ok: true, t: "Mintaszöveg: a látogatás 43%-kal nőtt, főleg a TikTokról.\nAz előnézetig jutók aránya 19%, ez stabil.\nTeendők:\n1. Tegyél rövid linket a következő 3 videóba.\n2. Javítsd az Androidos Google-belépést.\n3. Írj egy magyar tudástár-cikket a tetoválás öregedéséről." }); return; }
      const r = await fetch("/api/admin/ai", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ page, data: aiSafe(data) }) });
      const j = await r.json().catch(() => ({}));
      setOut(j.ok ? { ok: true, t: j.text } : { ok: false, t: j.error || "Nem sikerült." });
    } finally { setBusy(false); }
  };
  return (
    <div className="ai">
      {out ? <div className={out.ok ? "ai-t" : "alert err"}>{out.t.split("\n").map((l, i) => <p key={i}>{l}</p>)}</div> : <p className="note">Egy kattintás, kb. 10–20 másodperc. Napi legfeljebb {AI_DAILY} MI-hívás, minden oldal együtt.</p>}
      <button className={"adm-ibtn gold" + (busy ? " busy" : "")} onClick={run} disabled={busy}>{I(P.bolt)}{busy ? "Elemzés…" : out ? "Újra" : "Elemzés most"}</button>
    </div>
  );
}


/* a soft two-note chime (Web Audio, no file) */
export function chime(f: number) {
  try {
    const C = (window.AudioContext || (window as any).webkitAudioContext); const ctx = new C(); // eslint-disable-line @typescript-eslint/no-explicit-any
    [f, f * 1.5].forEach((hz, i) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = "sine"; o.frequency.value = hz; g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.09); g.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + i * 0.09 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.09 + 0.5); o.connect(g).connect(ctx.destination); o.start(ctx.currentTime + i * 0.09); o.stop(ctx.currentTime + i * 0.09 + 0.55); });
    setTimeout(() => ctx.close(), 1200);
  } catch {}
}

/* Side panels, sheets and the search: drawn in a layer at the top of the dashboard (outside the animated page, so
   they always open in view, not at the top of a long page), and the page behind them stands still while open.
   Nothing darkens or blurs it; a click beside the panel still closes it. */
let locks = 0;
/* while a popup is open the page behind never scrolls (the scrollbar's width is kept, so nothing shifts) */
export function useScrollLock(on: boolean) {
  useEffect(() => {
    if (!on) return;
    const h = document.documentElement.style, gap = window.innerWidth - document.documentElement.clientWidth;
    if (locks++ === 0) { h.overflow = "hidden"; h.overscrollBehavior = "none"; if (gap > 0) h.paddingRight = gap + "px"; }
    return () => { if (--locks === 0) { h.overflow = ""; h.overscrollBehavior = ""; h.paddingRight = ""; } };
  }, [on]);
}
export function Layer({ children }: { children: React.ReactNode }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => { setHost(document.getElementById("adm-layer") || document.body); }, []);
  useScrollLock(true);
  return host ? createPortal(children, host) : null;
}

/* Fresh numbers when a social page opens: if the platforms were last read more than 10 minutes ago, read them now
   (once per 3 minutes per browser), then show the result. The hourly run keeps them fresh in between. */
export function useFreshSocial(accounts: D[] | undefined, reload: () => void) {
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (MOCK || !accounts?.length) return;
    const old = accounts.some((a) => !a.last_sync_at || Date.now() - new Date(a.last_sync_at).getTime() > 10 * 60e3);
    let last = 0; try { last = Number(localStorage.getItem("inkage.admin.socsync") || 0); } catch {}
    if (!old || Date.now() - last < 3 * 60e3) return;
    try { localStorage.setItem("inkage.admin.socsync", String(Date.now())); } catch {}
    setBusy(true);
    api("/api/admin/sync?only=social", { method: "POST" }).then(() => reload()).finally(() => setBusy(false));
  }, [accounts?.length]); // eslint-disable-line react-hooks/exhaustive-deps
  return busy;
}

/* ---------- theme: auto (follows the phone or computer), day, night; kept in this browser ---------- */
export type ThemeMode = "auto" | "light" | "dark";
export const THEME_L: Record<ThemeMode, string> = { auto: "Automatikus", light: "Nappal", dark: "Éjszaka" };
const readTheme = (): ThemeMode => { try { const v = localStorage.getItem("inkage.admin.theme"); return v === "light" || v === "dark" ? v : "auto"; } catch { return "auto"; } };
const sysLight = () => { try { return !matchMedia("(prefers-color-scheme: dark)").matches; } catch { return false; } };
export function useTheme() {
  const [mode, setM] = useState<ThemeMode>(() => (typeof window === "undefined" ? "auto" : readTheme()));
  const [sys, setSys] = useState(() => (typeof window === "undefined" ? false : sysLight()));
  useEffect(() => { setM(readTheme()); setSys(sysLight()); const m = matchMedia("(prefers-color-scheme: dark)"); const f = () => setSys(!m.matches); m.addEventListener("change", f); return () => m.removeEventListener("change", f); }, []);
  const light = mode === "light" || (mode === "auto" && sys);
  /* the page before React (layout.tsx) reads the same mark: no flash on the next load */
  useEffect(() => { try { document.documentElement.setAttribute("data-adm-theme", light ? "light" : "dark"); } catch {} }, [light]);
  const setMode = (m: ThemeMode) => { setM(m); try { if (m === "auto") localStorage.removeItem("inkage.admin.theme"); else localStorage.setItem("inkage.admin.theme", m); } catch {} };
  const cycle = () => setMode(mode === "auto" ? (light ? "dark" : "light") : mode === "light" ? "dark" : "auto");
  return { mode, light, setMode, cycle };
}

/* this browser is the owner's: the site's tracker sends nothing from it (lib/track.ts reads the same mark) */
export const markOwnDevice = () => { try { localStorage.setItem("inkage.own", "1"); document.cookie = "inkage_own=1; path=/; max-age=63072000; samesite=lax; secure"; } catch {} };
export const OWN_LINK = "https://inkage.app/?inkage_own=1";

