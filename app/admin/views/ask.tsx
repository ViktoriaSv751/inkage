"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { BarList, Info, TrendChart, fmt } from "../charts";
import { toast, usePhone } from "../phone";
import { useOwnTasks } from "../phone-host";
import { Giant } from "../ink";
import { I, MOCK, P, PF, SOC, api, ch, lang, n, rpc, type D, useFlt } from "../shared";
import { vsMedian } from "./social";

/* ---------- ask your numbers: Claude answers from the dashboard's anonymous aggregates ---------- */
const SUGGEST = ["Melyik videóm hozta a legtöbb regisztrációt ebben az időszakban?", "Miért esett vissza a forgalom tegnap?", "Melyik csatornáról jutnak el a legtöbben a kész előnézetig?",
  "Mit posztoljak a héten a számok alapján?", "Hol esnek ki a legtöbben az appban, és mit tegyek ellene?", "Melyik nyelven érdemes több tartalmat csinálni?"];
/* question templates per platform */
const PF_Q: Record<string, string[]> = {
  tiktok: ["Melyik TikTok-videóm teljesített a legjobban a szokásoshoz képest, és miért?", "Milyen hosszú TikTok-videók hoznak nálam több látogatót?"],
  instagram: ["Reel vagy kép: melyik működik jobban nálam Instagramon?", "Hogyan nőnek az Instagram-követőim, és melyik poszt után ugrott?"],
  youtube: ["Melyik YouTube-videómat nézik végig a legtovább?", "Hoz-e a YouTube látogatót az oldalra?"],
  pinterest: ["Melyik pinem kapja a legtöbb megjelenést?", "Megéri-e Pinterestre posztolni a látogatók alapján?"],
  facebook: ["Melyik Facebook-posztom hozott a legtöbb reakciót?"], linkedin: ["Mit érdemes LinkedInre posztolni a számaim alapján?"],
  google: ["Melyik keresésekre vagyok majdnem az első oldalon?", "Melyik cikkem hoz Google-kattintást, és melyik nem?"],
};
const KEY = "inkage.admin.ask";
const HETI = "Készíts elő nekem egy heti stratégiai beszélgetést: a múlt hét 3 legfontosabb változása a számokból, mi a döntés, amit most meg kell hoznom, és 3 kérdés, amin érdemes gondolkodnom.";

/* keeps what goes to Claude short: long lists cut, long texts trimmed, nothing deeper than three levels */
const trim = (v: any, depth = 0): any => {
  if (v == null || typeof v === "number" || typeof v === "boolean") return v;
  if (typeof v === "string") return v.length > 160 ? v.slice(0, 160) + "…" : v;
  if (depth > 3) return undefined;
  if (Array.isArray(v)) return v.slice(0, 12).map((x) => trim(x, depth + 1));
  if (typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, trim(x, depth + 1)]).filter(([, x]) => x !== undefined));
  return undefined;
};

/* what Claude gets: one period for everything (traffic, posts and Google alike), the filter, the posts' sign-ups,
   the best posts (not the newest), followers, stores, YouTube, appearances, Bing, the inbox, links, plans, notes,
   retention; never e-mails, names or the live feed */
function summary(d: D, x: D, flt: D) {
  const posts: D[] = (x.soc?.posts || []) as D[], vs = vsMedian(posts, (x.soc?.cal || []) as D[]);
  const best = [...posts].sort((a, b) => (vs(b) ?? -1) - (vs(a) ?? -1) || n(b.sessions) - n(a.sessions)).slice(0, 40);
  const newest = [...posts].sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || ""))).slice(0, 10).filter((p) => !best.includes(p));
  const daily: D[] = (x.soc?.daily || []) as D[];
  const fol = SOC.map((k) => { const r = daily.filter((y) => y.platform === k && y.followers != null); return r.length ? { platform: PF[k], most: r[r.length - 1].followers, idoszak_elejen: r[0].followers } : null; }).filter(Boolean);
  const post = (p: D) => ({ platform: p.platform, mikor: p.created_at, cim: String(p.title || "").slice(0, 80), megtekintes: p.views, szokasos_szorzo: vs(p) == null ? null : Math.round(vs(p)! * 10) / 10,
    kedveles: p.likes, mentes: p.saves, megosztas: p.shares, latogato: p.sessions, elonezetig_jutott: p.scored, regisztracio: p.signups, rovid_link: !!p.code,
    /* what she typed in from TikTok Studio (watch time, completion, reach, traffic sources) goes too */
    atlagos_nezesi_ido_mp: p.watch_avg ?? null, vegignezes: p.completion ?? null, eleres: p.reach ?? null, forgalomforras: p.traffic ?? null, profilnezes: p.profile_visits ?? null, uj_kovetok: p.follows ?? null });
  return {
    idoszak: { nap: d.days, tol: d.from, ig: d.to }, szuro: flt.ch || flt.lang ? { csatorna: flt.ch ? flt.ch.split(",").map(ch).join(", ") : null, nyelv: flt.lang ? lang(flt.lang) : null, megjegyzes: "a forgalmi számok szűrtek; a posztok, a követők, a Google és az áruházak nem" } : null,
    most: d.now, elozo: d.prev, ma: d.today, osszes: { elkeszult_elonezet: d.all?.made, elonezetet_keszitett_fiok: d.all?.made_users, fiokok: d.all?.users, elonezetig_jutott: d.all?.scored },
    fogalmak: "Az InkAge tetoválás-előnézet app: bőrfotó → minta → AI-előnézet a bőrön → megnézi, hogy néz ki 50 év múlva → ment → megoszt. made: elkészült AI-előnézet, minden eszközről (ez a termék); revealed: megnézte 50 év múlva; scored: eljutott az előnézetig; shared: valódi megosztás (link, videó, meghívó); saved: mentett előnézet, nem megosztás. A látogatási és lépésszámok csak azoktól jönnek, akik a sütisávban elfogadták a statisztikát; a made és a signups mindenkit számol. A 0 hiba nem jelenti biztosan, hogy nem volt hiba. null: nem mérhető, nem nulla.",
    idoszak_megjegyzes: "A forgalom, a posztok, a Google és az áruházak ugyanarra az időszakra szólnak. A megtartás minden fiókra, a YouTube, a postafiók, a linkek és a tervek a mostani állapotra.",
    csatornak: (d.channels || []).slice(0, 10), tolcser: d.funnel, nyelvek: (d.langs || []).slice(0, 10), napi: (d.trend || []).map((y: D) => ({ t: y.t, latogatas: y.sessions, elkeszult_elonezet: y.made, regisztracio: y.signups })),
    posztok_legjobb: best.map(post), posztok_legujabb: newest.map(post), posztok_megjegyzes: "a szokásos szorzó a poszt megtekintése a saját platformja mediánjához képest; Pinterest és LinkedIn: megjelenés",
    leadek: x.soc?.leads, kovetok: fol,
    /* one Google number: the Google page's (exact daily totals, finished days); the appearances below leave Google out */
    google: x.gsc ? { kattintas: x.gsc.totals?.clicks, megjelenes: x.gsc.totals?.impressions, idoszak: { tol: x.gsc.from, ig: x.gsc.last_day, megjegyzes: "a Google napi összesítője, a mai félkész nap nélkül" }, elozo: x.gsc.prev,
      majdnem_elso_oldal: (x.gsc.near || []).slice(0, 10), uj_keresesek: (x.gsc.new_queries || []).slice(0, 8), alacsony_ctr: (x.gsc.low_ctr || []).slice(0, 8) } : null,
    megjelenes: x.imp ? { osszes_google_nelkul: Object.fromEntries(Object.entries((x.imp.totals || {}) as D).filter(([k]) => k !== "google")), elozo: Object.fromEntries(Object.entries((x.imp.prev || {}) as D).filter(([k]) => k !== "google")),
      bing: x.imp.totals?.bing ?? null, videomegtekintes_nem_megjelenes: x.imp.views || {}, megjegyzes: "a TikTok-megtekintés nem megjelenés; a Google száma a google mezőben" } : null,
    aruhazak: trim(x.stores), youtube: x.yt ? { nezo_megtartas_videok: (x.yt.retention || []).length, demografia: trim(x.yt.demo) } : null,
    postafiok: x.inbox ? { valaszra_var: x.inbox.open, cimkek: ((x.inbox.items || []) as D[]).reduce((o: D, y) => { if (y.tag && !y.done) o[y.tag] = (o[y.tag] || 0) + 1; return o; }, {}), hibajelzesek: ((x.inbox.bugs || []) as D[]).length } : null,
    rovid_linkek: trim(x.links), tervek: trim(((x.plans || []) as D[]).map((p) => ({ nap: p.day, cim: p.title, platformok: p.platforms, allapot: p.status }))), jegyzetek: trim(((x.notes || []) as D[]).map((y) => ({ nap: y.day, tipus: y.kind, szoveg: y.text }))),
    /* never the dormant list (it holds e-mails), and the newest days of activity: the list runs from old to new, and cutting it to 12 sent days before the first account */
    megtartas: x.ret ? { fiokok: x.ret.accounts_all, alvo_fiokok: x.ret.dormant, aktivitas_utolso_14_nap: ((x.ret.active || []) as D[]).slice(-14), visszateres: x.ret.curve, kohorszok: trim(x.ret.cohorts), bontas: trim(x.ret.by),
      megjegyzes: "*_used, back: valódi használat (előnézet vagy mentés); dau, wau, mau, opened: csak munkamenet nyílt, a regisztráció napja is. A bontás forrása becslés." } : null,
  };
}

/* no AI key yet: plain steps, and the way to the paste field on the Kapcsolatok page */
function NoKey() {
  const open = () => { try { sessionStorage.setItem("inkage.admin.connfocus", "ai"); } catch {} location.hash = "#connect"; };
  return (
    <div className="g io io-ask">
      <section className="s12 ink-hero io-ask-hero"><span className="ink-hero-l">Kérdezz a számaidtól</span><h2 className="io-state-t">Mit kérdezel?</h2></section>
      {/* what she could ask, shown but not pressable: without a key there is nobody to answer */}
      <div className="s12 io-sugs" aria-label="Ezeket kérdezheted majd">{SUGGEST.slice(0, 4).map((s) => <span key={s} className="io-sug off">{s}</span>)}</div>
      <section className="s12 io-card ink-flip io-ask-nokey">
        <b className="io-card-t">Még nincs kulcs, ezért most nem tud válaszolni</b>
        <p className="io-card-s">A válaszokat a Claude adja, ehhez kell egy saját kulcs. Egyszer kell beállítani, kb. 2 perc. A használatot az Anthropic számolja el veled.</p>
        <ol>
          <li>Nyisd meg a Claude Console-t, és lépj be. <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">console.anthropic.com ↗</a></li>
          <li>Nyomd meg a <b>Create Key</b> gombot, adj neki nevet (pl. InkAge), és másold ki a kulcsot. Csak egyszer látszik.</li>
          <li>Nyomd meg az alábbi gombot, illeszd be a mezőbe, és nyomj <b>Mentést</b>. Utána gyere vissza ide.</li>
        </ol>
        <div className="io-card-a"><button className="adm-ibtn gold" onClick={open}>A beillesztő mező megnyitása</button></div>
      </section>
    </div>
  );
}

/* every number the data holds, to check what the answer says it used */
const allNums = (v: unknown, out = new Set<number>()) => { if (typeof v === "number") out.add(Math.round(v * 10) / 10); else if (typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v)) out.add(Math.round(Number(v) * 10) / 10); else if (Array.isArray(v)) v.forEach((x) => allNums(x, out)); else if (v && typeof v === "object") Object.values(v).forEach((x) => allNums(x, out)); return out; };
const lineStart = (t: string, w: string) => t.split("\n").findIndex((l) => l.trim().startsWith(w + " "));
const withoutLines = (t: string) => t.split("\n").filter((l) => !/^\s*(CHART|FORRAS) /.test(l)).join("\n").trim();
/* what the answer says it used, each checked against what it really got */
const usedOf = (t: string, data: unknown): Used[] => { const i = lineStart(t, "FORRAS"); if (i < 0) return []; try { const a = JSON.parse(t.split("\n")[i].trim().slice(7)); const ns = allNums(data); return (Array.isArray(a) ? a : []).slice(0, 6).map((x: D) => ({ l: String(x.l || "").slice(0, 80), v: Number(x.v), ok: ns.has(Math.round(Number(x.v) * 10) / 10) })).filter((x) => x.l && Number.isFinite(x.v)); } catch { return []; } };
type Used = { l: string; v: number; ok: boolean };
type Msg = { q: string; a?: string; err?: boolean; at?: string; used?: Used[] };
const LOST = "A válasz megszakadt, mert közben elhagytad az oldalt.";
/* a question spoken aloud, where the phone's browser can: Chrome on Android, Safari on an iPhone in some cases. Nothing shows where it cannot. */
const SR = () => (typeof window === "undefined" ? null : (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null);
export function Ask({ d, conv }: { d: D; conv?: boolean }) {
  const phone = usePhone(); const [, setTasks] = useOwnTasks();
  const [hearing, setHearing] = useState(false); const [talk, setTalk] = useState(false); const talkRef = useRef(false); talkRef.current = talk;
  const say = (t: string) => { if (!talkRef.current || !("speechSynthesis" in window)) return; speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(withoutLines(t)); u.lang = "hu-HU"; const v = speechSynthesis.getVoices().find((x) => x.lang?.toLowerCase().startsWith("hu")); if (v) u.voice = v; speechSynthesis.speak(u); };
  const hear = () => { const R = SR(); if (!R) return; const r = new R(); r.lang = "hu-HU"; r.interimResults = false; r.maxAlternatives = 1; setHearing(true);
    r.onresult = (e: any) => { const t = String(e.results?.[0]?.[0]?.transcript || ""); setHearing(false); if (t) { setTalk(true); talkRef.current = true; ask(t); } };
    r.onerror = (e: any) => { setHearing(false); toast(e?.error === "not-allowed" ? "A mikrofon nincs engedélyezve" : "Nem sikerült a hangfelismerés: írd be a kérdést"); }; r.onend = () => setHearing(false);
    try { r.start(); } catch { setHearing(false); } };
  useEffect(() => () => { if ("speechSynthesis" in window) speechSynthesis.cancel(); }, []);
  const sb = useMemo(() => supabaseBrowser(), []);
  const { f: flt } = useFlt();
  const [x, setX] = useState<D>({}); const [ready, setReady] = useState(false);
  /* the conversation stays (in this browser) until it is cleared; it can be saved as a file */
  /* a question left without an answer stays one to send again, not an endless "Gondolkodom…" */
  const [msgs, setMsgs] = useState<Msg[]>(() => { try { return (JSON.parse(localStorage.getItem(KEY) || "[]") as Msg[]).map((m) => (m.a ? m : { ...m, a: LOST, err: true })); } catch { return []; } });
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(msgs.slice(-40))); } catch {} }, [msgs]);
  const [q, setQ] = useState(""); const [busy, setBusy] = useState(false); const [pf, setPf] = useState("");
  /* is there an AI key at all (the status route says, never the value) */
  const [noKey, setNoKey] = useState(false);
  useEffect(() => { api("/api/admin/status").then((r) => { if (r.ok && r.json && r.json.ai === false) setNoKey(true); }).catch(() => {}); }, []);
  const end = useRef<HTMLDivElement>(null);
  /* every source over the same period as the traffic (posts and Google were fixed at 30 and 28 days) */
  const days = d.days || 30;
  useEffect(() => {
    setReady(false);
    const t = new Date(), k = (o: number) => new Date(t.getTime() + o * 864e5).toISOString().slice(0, 10);
    const get = (fn: string, args?: D) => rpc(sb, fn, args).then(({ data }) => data ?? null).catch(() => null);
    Promise.all([get("admin_social", { p_days: days }), get("admin_search", { p_days: Math.min(Math.max(days, 1), 480) }) /* the same period as everything else (Google's own window ends at its last finished day) */, get("admin_impressions", { p_days: Math.min(days, 365) }), get("admin_stores", { p_days: days }),
      get("admin_youtube"), get("admin_inbox", { p_all: false }), get("admin_links"), get("admin_plans", { p_from: k(-7), p_to: k(21) }), get("admin_notes_list", {}), get("admin_retention")])
      .then(([soc, gsc, imp, stores, yt, inbox, links, plans, notes, ret]) => { setX({ soc, gsc, imp, stores, yt, inbox, links, plans, notes, ret }); setReady(true); });
  }, [sb, days]);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs]);
  /* a question sent from another page ("Kérdezz erről az oldalról"): asked as soon as the data is in */
  useEffect(() => { if (!ready) return; let q0 = ""; try { q0 = sessionStorage.getItem("inkage.admin.askq") || ""; sessionStorage.removeItem("inkage.admin.askq"); } catch {} if (q0) ask(q0); }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps
  const ask = async (text: string) => {
    const t = text.trim(); if (!t || busy) return;
    setQ(""); setBusy(true); setMsgs((m) => [...m, { q: t, at: new Date().toISOString() }]);
    const history = msgs.filter((m) => m.a && !m.err).slice(-8).map((m) => ({ q: m.q, a: withoutLines(String(m.a)).slice(0, 1200) }));
    /* the card she asked from: its visible lines (e-mails already masked) */
    let kartya: string[] | undefined; try { const c = sessionStorage.getItem("inkage.admin.askctx"); if (c) { kartya = JSON.parse(c); sessionStorage.removeItem("inkage.admin.askctx"); } } catch {}
    const sent = { ...summary(d, x, flt), ...(kartya ? { kartya } : {}) };
    const r = MOCK ? { ok: true, json: { text: `Mintaválasz: a TikTok hozta a legtöbb látogatót (${n(d.channels?.[1]?.sessions)}). A héten érdemes egy hasonló, „before → after” típusú videót posztolni, rövid linkkel.\nCHART {"type":"bar","title":"Látogató videónként","data":[{"k":"#12","v":401},{"k":"#11","v":233},{"k":"#10","v":120}]}\nFORRAS [{"l":"TikTok-látogatás, az időszakban","v":${n(d.channels?.[1]?.sessions)}},{"l":"Egy kitalált szám a próbához","v":123456}]` } }
      : await api("/api/admin/ai", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode: "ask", question: t, history, data: sent }) }).catch(() => ({ ok: false, json: { error: "Nem sikerült: nincs kapcsolat." } as D }));
    setBusy(false);
    const ans = r.ok ? r.json?.text || "–" : r.json?.error || "Nem sikerült.";
    if (!r.ok && /MI-kulcs/.test(String(r.json?.error || ""))) { setMsgs((m) => m.slice(0, -1)); setQ(t); setNoKey(true); return; }
    setMsgs((m) => m.map((y, i) => (i === m.length - 1 ? { ...y, a: ans, err: !r.ok, used: r.ok ? usedOf(ans, sent) : undefined } : y)));
    if (r.ok) say(ans);
  };
  /* the failed question goes again, in its place at the end of the conversation */
  const again = (i: number) => { const t = msgs[i].q; setMsgs((m) => m.filter((_, j) => j !== i)); ask(t); };
  const exportIt = () => {
    const body = msgs.map((m) => `## ${m.q}\n${m.at ? `_${new Date(m.at).toLocaleString("hu-HU")}_\n` : ""}\n${withoutLines(String(m.a || ""))}\n`).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([`# Kérdezz · InkAge\n\n${body}`], { type: "text/markdown;charset=utf-8" })); a.download = `inkage-kerdezz-${new Date().toISOString().slice(0, 10)}.md`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  /* "Tedd a heti tervbe": the answer's first sentence becomes a step of this week's plan */
  const toPlan = async (a: string) => {
    const first = withoutLines(a).split("\n").map((l) => l.trim()).filter(Boolean)[0] || a;
    const step = first.replace(/^[-•\d.)\s]+/, "").slice(0, 200);
    const { data, error } = await rpc(sb, "admin_week_plan");
    if (error) { toast(error.message); return; }
    const items: D[] = ((data as D)?.items || []) as D[];
    const r = await rpc(sb, "admin_week_plan_save", { p_items: [...items, { t: step, why: "a Kérdezz válaszából", done: false }].slice(0, 6) });
    toast(r.error ? r.error.message : "Bekerült a heti tervbe");
  };
  /* every platform is offered; the ones without data are faint (the answer then says there is nothing to go on) */
  const pfs = Object.keys(PF_Q), hasPf = (k: string) => (k === "google" ? !!x.gsc : ((x.soc?.accounts || []) as D[]).some((a) => a.platform === k));
  if (noKey) return <NoKey />;
  return (
    <div className={"g io io-ask" + (conv ? " ma-conv" : "")}>
      <section className="s12 io-ask-s">
        {!ready && !msgs.length ? <div className="io-ask-e"><div className="skel" style={{ height: 90, borderRadius: 26 }} /><div className="skel" style={{ height: 120, borderRadius: 26 }} /></div>
          : !msgs.length ? <div className="io-ask-e">
          <section className="ink-hero io-ask-hero"><span className="ink-hero-l">Kérdezz a számaidtól<Info>Az MI az irányítóközpont anonim összesítőiből válaszol (e-mail, név és élő esemény nélkül). A forgalom, a posztok, a Google és az áruházak ugyanarra az időszakra szólnak{flt.ch || flt.lang ? ", a szűrőt is ismerve" : ""}; a megtartás minden fiókra, a YouTube és a postafiók a mostani állapotra. Pár másodperc.</Info></span><h2 className="io-state-t">Mit kérdezel?</h2></section>
          <div className="io-sugs">{(phone ? [HETI, ...SUGGEST] : SUGGEST).map((s) => <button key={s} className="io-sug" onClick={() => ask(s)}>{s === HETI ? "Készítsd elő a heti stratégiai beszélgetést" : s}</button>)}</div>
          {pfs.length > 0 && <div className="io-ask-pf"><div className="io-scroll" role="group" aria-label="Platform">{pfs.map((k) => <button key={k} className={"io-src" + (hasPf(k) ? "" : " off")} aria-pressed={pf === k} title={hasPf(k) ? undefined : `${k === "google" ? "Google" : PF[k]}: még nincs bekötve, nincs miből válaszolni`} onClick={() => setPf(pf === k ? "" : k)}>{k === "google" ? "Google" : PF[k]}</button>)}</div>
            {pf && <div className="io-sugs">{PF_Q[pf].map((s) => <button key={s} className="io-sug" onClick={() => ask(s)}>{s}</button>)}</div>}</div>}</div>
          : <div className="ask-l">{msgs.map((m, i) => <div key={i}><div className="ask-q">{m.q}</div>{m.a ? <Answer t={m.a} err={m.err} used={m.used} retry={m.err && !busy ? () => again(i) : undefined} toPlan={m.err ? undefined : () => toPlan(m.a!)} toTask={phone && !m.err ? () => { const step = withoutLines(m.a!).split("\n").map((l) => l.trim()).filter(Boolean)[0] || ""; setTasks((o) => [...o, { id: String(Date.now()), t: step.slice(0, 200), at: new Date().toISOString(), to: "ask" as const }].slice(-40)); toast("Teendő lett belőle"); } : undefined} /> : <div className="ask-a wait"><span className="spin" />Gondolkodom…</div>}</div>)}<div ref={end} /></div>}
        {msgs.length > 0 && <div className="io-ask-tools"><button className="io-pill" onClick={exportIt}>Mentés fájlba (.md)</button><button className="io-pill" onClick={() => { if (confirm("Törlöd a beszélgetést?")) setMsgs([]); }}>Új beszélgetés</button><Info>Az utolsó 8 kérdés-válasz pár megy előzményként.</Info></div>}
        {phone && "speechSynthesis" in globalThis && <button type="button" className={"ma-talk" + (talk ? " on" : "")} role="switch" aria-checked={talk} onClick={() => { if (talk) speechSynthesis.cancel(); setTalk(!talk); }}><span className={"sw" + (talk ? " on" : "")}><i /></span>Hangos válasz{SR() ? "" : " (a hangos kérdést ez a böngésző nem tudja)"}</button>}
      </section>
      <div className="s12 io-ask-bar">
        <form className="io-ask-f" onSubmit={(e) => { e.preventDefault(); ask(q); }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Írd be a kérdésed…" aria-label="A kérdésed" enterKeyHint="send" />
          {phone && SR() && <button type="button" className={"io-ask-mic" + (hearing ? " on" : "")} onClick={hear} disabled={busy || !ready} aria-label={hearing ? "Hallgatlak" : "Kérdezz hanggal"}>{I(P.mic)}</button>}
          <button className="io-ask-go" disabled={busy || !q.trim() || !ready}>{ready ? "Kérdezem" : "Betöltés…"}</button>
        </form>
      </div>
    </div>
  );
}

/* the answer, and when Claude added one, its chart (a line "CHART {json}" after the text) */
function Answer({ t, err, toPlan, toTask, used, retry }: { t: string; err?: boolean; toPlan?: () => void; toTask?: () => void; used?: Used[]; retry?: () => void }) {
  const lines = t.split("\n").filter((l) => !l.trim().startsWith("FORRAS ")), ci = lines.findIndex((l) => l.trim().startsWith("CHART "));
  let chart: D | null = null;
  if (ci >= 0) { try { chart = JSON.parse(lines[ci].trim().slice(6)); } catch { chart = null; } }
  const text = lines.filter((_, i) => i !== ci).join("\n").trim();
  const data: D[] = Array.isArray(chart?.data) ? chart!.data.filter((x: D) => x && x.k != null && Number.isFinite(Number(x.v))).slice(0, 12) : [];
  const dates = data.length > 1 && data.every((x) => !Number.isNaN(Date.parse(String(x.k))));
  return (
    <div className={"ask-a" + (err ? " err" : "")}>
      {/* first the figures it says it used, each checked against the data; then the chart; then the words */}
      {used && used.length > 0 && <ul className="io-nums" aria-label="Ezekből a számokból dolgoztam">{used.map((x, i) => <li key={i} className={x.ok ? "" : "no"}><Giant text={fmt(x.v, 1)} max={34} /><small>{x.l}</small>{!x.ok && <em>! nincs az adatokban, ellenőrizd</em>}</li>)}</ul>}
      {data.length > 0 && <div className="ask-ch">{chart?.title && <b>{chart.title}</b>}
        {chart?.type === "line" && dates ? <TrendChart data={data.map((x) => ({ t: String(x.k), v: Number(x.v) }))} label={chart?.title || "Érték"} height={180} />
          : <BarList items={data.map((x) => ({ k: String(x.k), n: Number(x.v) }))} max={12} accent />}</div>}
      {text.split("\n").map((l, i) => <p key={i}>{l}</p>)}
      {used && !used.length && !err && <p className="ma-why">Ehhez a válaszhoz nem sorolt fel számokat, ellenőrizd a részleteket.</p>}
      {retry && <button className="lnk ask-plan" onClick={retry}>{I(P.refresh)}Újraküldés</button>}
      {toPlan && <button className="lnk ask-plan" onClick={toPlan}>{I(P.target)}Tedd a heti tervbe</button>}
      {toTask && <button className="lnk ask-plan" onClick={toTask}>{I(P.check)}Legyen belőle teendő</button>}
    </div>
  );
}
