"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { BarList, TrendChart } from "../charts";
import { toast } from "../phone";
import { I, MOCK, P, PF, SOC, api, ch, lang, n, rpc, type D, useFlt } from "../shared";
import { vsMedian } from "./social";

/* ---------- ask your numbers: Claude answers from the dashboard's anonymous aggregates ---------- */
const SUGGEST = ["Melyik videóm hozta a legtöbb regisztrációt ebben az időszakban?", "Miért esett vissza a forgalom tegnap?", "Melyik csatorna konvertál a legjobban az előnézetig?",
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
    kedveles: p.likes, mentes: p.saves, megosztas: p.shares, latogato: p.sessions, elemzes: p.scored, regisztracio: p.signups, rovid_link: !!p.code,
    /* what she typed in from TikTok Studio (watch time, completion, reach, traffic sources) goes too */
    atlagos_nezesi_ido_mp: p.watch_avg ?? null, vegignezes: p.completion ?? null, eleres: p.reach ?? null, forgalomforras: p.traffic ?? null, profilnezes: p.profile_visits ?? null, uj_kovetok: p.follows ?? null });
  return {
    idoszak: { nap: d.days, tol: d.from, ig: d.to }, szuro: flt.ch || flt.lang ? { csatorna: flt.ch ? flt.ch.split(",").map(ch).join(", ") : null, nyelv: flt.lang ? lang(flt.lang) : null, megjegyzes: "a forgalmi számok szűrtek; a posztok, a követők, a Google és az áruházak nem" } : null,
    most: d.now, elozo: d.prev, ma: d.today, osszes: { elemzes: d.all?.scored, fiokok: d.all?.users },
    csatornak: (d.channels || []).slice(0, 10), tolcser: d.funnel, nyelvek: (d.langs || []).slice(0, 10), napi: (d.trend || []).map((y: D) => ({ t: y.t, latogatas: y.sessions, elemzes: y.scored, regisztracio: y.signups })),
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
    megtartas: trim(x.ret),
  };
}

type Msg = { q: string; a?: string; err?: boolean; at?: string };
export function Ask({ d }: { d: D }) {
  const sb = useMemo(() => supabaseBrowser(), []);
  const { f: flt } = useFlt();
  const [x, setX] = useState<D>({}); const [ready, setReady] = useState(false);
  /* the conversation stays (in this browser) until it is cleared; it can be saved as a file */
  const [msgs, setMsgs] = useState<Msg[]>([]);
  useEffect(() => { try { setMsgs(JSON.parse(localStorage.getItem(KEY) || "[]")); } catch {} }, []);
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(msgs.slice(-40))); } catch {} }, [msgs]);
  const [q, setQ] = useState(""); const [busy, setBusy] = useState(false); const [pf, setPf] = useState("");
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
    const history = msgs.filter((m) => m.a && !m.err).slice(-8).map((m) => ({ q: m.q, a: String(m.a).slice(0, 1200) }));
    const r = MOCK ? { ok: true, json: { text: "Mintaválasz: a TikTok #12 videó hozta a legtöbb látogatót (401), főleg angolul. A héten érdemes egy hasonló, „before → after” típusú videót posztolni, rövid linkkel.\nCHART {\"type\":\"bar\",\"title\":\"Látogató videónként\",\"data\":[{\"k\":\"#12\",\"v\":401},{\"k\":\"#11\",\"v\":233},{\"k\":\"#10\",\"v\":120}]}" } }
      : await api("/api/admin/ai", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode: "ask", question: t, history, data: summary(d, x, flt) }) });
    setBusy(false);
    setMsgs((m) => m.map((y, i) => (i === m.length - 1 ? { ...y, a: r.ok ? r.json?.text || "–" : r.json?.error || "Nem sikerült.", err: !r.ok } : y)));
  };
  const exportIt = () => {
    const body = msgs.map((m) => `## ${m.q}\n${m.at ? `_${new Date(m.at).toLocaleString("hu-HU")}_\n` : ""}\n${String(m.a || "").split("\n").filter((l) => !l.trim().startsWith("CHART ")).join("\n")}\n`).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([`# Kérdezz · InkAge\n\n${body}`], { type: "text/markdown;charset=utf-8" })); a.download = `inkage-kerdezz-${new Date().toISOString().slice(0, 10)}.md`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  /* "Tedd a heti tervbe": the answer's first sentence becomes a step of this week's plan */
  const toPlan = async (a: string) => {
    const first = a.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("CHART "))[0] || a;
    const step = first.replace(/^[-•\d.)\s]+/, "").slice(0, 200);
    const { data, error } = await rpc(sb, "admin_week_plan");
    if (error) { toast(error.message); return; }
    const items: D[] = ((data as D)?.items || []) as D[];
    const r = await rpc(sb, "admin_week_plan_save", { p_items: [...items, { t: step, why: "a Kérdezz válaszából", done: false }].slice(0, 6) });
    toast(r.error ? r.error.message : "Bekerült a heti tervbe");
  };
  /* every platform is offered; the ones without data are faint (the answer then says there is nothing to go on) */
  const pfs = Object.keys(PF_Q), hasPf = (k: string) => (k === "google" ? !!x.gsc : ((x.soc?.accounts || []) as D[]).some((a) => a.platform === k));
  return (
    <div className="g">
      <section className="c s12 ask">
        {!ready && !msgs.length ? <div className="ask-empty"><div className="skel" style={{ height: 22, width: 220, borderRadius: 99 }} /><div className="skel" style={{ height: 120, width: "min(560px,90%)" }} /></div>
          : !msgs.length ? <div className="ask-empty"><span className="ask-ic">{I(P.spark)}</span><h2>Kérdezz a számaidtól</h2><p className="note">Az MI az irányítóközpont anonim összesítőiből válaszol (e-mail, név és élő esemény nélkül), mindenhol ugyanarra az időszakra{flt.ch || flt.lang ? ", a szűrőt is ismerve" : ""}. Pár másodperc.</p>
          <div className="ask-sug">{SUGGEST.map((s) => <button key={s} onClick={() => ask(s)}>{s}</button>)}</div>
          {pfs.length > 0 && <div className="ask-pf"><div className="adm-seg sm" role="group">{pfs.map((k) => <button key={k} aria-pressed={pf === k} className={hasPf(k) ? undefined : "off"} title={hasPf(k) ? undefined : `${k === "google" ? "Google" : PF[k]}: még nincs bekötve, nincs miből válaszolni`} onClick={() => setPf(pf === k ? "" : k)}>{k === "google" ? "Google" : PF[k]}</button>)}</div>
            {pf && <div className="ask-sug">{PF_Q[pf].map((s) => <button key={s} onClick={() => ask(s)}>{s}</button>)}</div>}</div>}</div>
          : <div className="ask-l">{msgs.map((m, i) => <div key={i}><div className="ask-q">{m.q}</div>{m.a ? <Answer t={m.a} err={m.err} toPlan={m.err ? undefined : () => toPlan(m.a!)} /> : <div className="ask-a wait"><span className="spin" />Gondolkodom…</div>}</div>)}<div ref={end} /></div>}
        <form className="ask-f" onSubmit={(e) => { e.preventDefault(); ask(q); }}>
          <input className="adm-in" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pl. melyik videóm hozta a legtöbb regisztrációt?" />
          <button className="adm-ibtn gold" disabled={busy || !q.trim() || !ready}>{ready ? "Kérdezem" : "Betöltés…"}</button>
        </form>
        {msgs.length > 0 && <div className="adm-row ask-tools"><button className="lnk" onClick={exportIt}>Mentés fájlba (.md)</button><button className="lnk" onClick={() => { if (confirm("Törlöd a beszélgetést?")) setMsgs([]); }}>Új beszélgetés</button><span className="note">Az utolsó 8 kérdés-válasz pár megy előzményként.</span></div>}
      </section>
    </div>
  );
}

/* the answer, and when Claude added one, its chart (a line "CHART {json}" after the text) */
function Answer({ t, err, toPlan }: { t: string; err?: boolean; toPlan?: () => void }) {
  const lines = t.split("\n"), ci = lines.findIndex((l) => l.trim().startsWith("CHART "));
  let chart: D | null = null;
  if (ci >= 0) { try { chart = JSON.parse(lines[ci].trim().slice(6)); } catch { chart = null; } }
  const text = lines.filter((_, i) => i !== ci).join("\n").trim();
  const data: D[] = Array.isArray(chart?.data) ? chart!.data.filter((x: D) => x && x.k != null && Number.isFinite(Number(x.v))).slice(0, 12) : [];
  const dates = data.length > 1 && data.every((x) => !Number.isNaN(Date.parse(String(x.k))));
  return (
    <div className={"ask-a" + (err ? " err" : "")}>
      {text.split("\n").map((l, i) => <p key={i}>{l}</p>)}
      {data.length > 0 && <div className="ask-ch">{chart?.title && <b>{chart.title}</b>}
        {chart?.type === "line" && dates ? <TrendChart data={data.map((x) => ({ t: String(x.k), v: Number(x.v) }))} label={chart?.title || "Érték"} height={180} />
          : <BarList items={data.map((x) => ({ k: String(x.k), n: Number(x.v) }))} max={12} accent />}</div>}
      {toPlan && <button className="lnk ask-plan" onClick={toPlan}>{I(P.target)}Tedd a heti tervbe</button>}
    </div>
  );
}
