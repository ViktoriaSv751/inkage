"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { CountUp, fmt } from "../charts";
import { GoalRing } from "../wow";
import { toast } from "../phone";
import { Band, Card, GOAL_M, bpDate, I, LANGS, NOTE_KIND, P, PF, SOC, Tbl, api, ago, ch, n, rpc, type D, useRpc } from "../shared";
import { ShareLinks } from "./links";
import { WhatIf } from "./product";

/* every goal the database accepts now (it allowed six; the platform goals were lost without a word) */
export const GM: Record<string, string> = { ...GOAL_M, followers: "Új követő (összes platform)", gsc_impressions: "Google-megjelenés", bing_clicks: "Bing-kattintás", downloads: "Letöltés (áruházak)", reviews: "Áruházi értékelés",
  ...Object.fromEntries(SOC.flatMap((p) => [[`followers_${p}`, `${PF[p]}: új követő`], [`views_${p}`, p === "pinterest" ? "Pinterest: megjelenés" : `${PF[p]}: új megtekintés`], [`visits_${p}`, `${PF[p]}: látogató`]])) };
const PER: Record<string, string> = { week: "heti", month: "havi", quarter: "negyedéves", year: "éves", custom: "egyedi" };
const NOTE: Record<string, string> = { gsc_clicks: "a Google 2–3 nap késéssel ad: ugyanannyi nap, a legutolsó adatig", gsc_impressions: "a Google késésével igazítva", views_pinterest: "a fiók napi megjelenései (egy pin „megtekintése” 90 napos gördülő összeg)", followers: "a periódusban szerzett, nem az összes" };

/* one pace for every place: where the goal ends if it goes on like so far (its own window, Budapest time) */
export const paceOf = (g: D) => {
  const t0 = new Date(g.t0).getTime(), t1 = new Date(g.t1).getTime(), now = Math.min(Date.now(), t1);
  const gone = Math.max(0.05, (now - t0) / Math.max(1, t1 - t0));
  return { proj: n(g.value) / gone, gone, left: Math.max(0, (t1 - Date.now()) / 864e5) };
};
export const forecast = (g: D) => (n(g.target) ? `az ütem: ${fmt(Math.min(999, (paceOf(g).proj / n(g.target)) * 100))}%` : "");

export function Goals({ d }: { d: D }) {
  const [nm, setNm] = useState("scored"); const [np, setNp] = useState<string>("week");
  const [cs, setCs] = useState(bpDate()); const [ce, setCe] = useState(bpDate(new Date(Date.now() + 30 * 864e5)));
  const sb = useMemo(() => supabaseBrowser(), []);
  const g = useRpc("admin_goals_list", undefined, []); const nt = useRpc("admin_notes_list", {}, []);
  const [st, setSt] = useState<D | null>(null); const [rs, setRs] = useState<D | null>(null);
  useEffect(() => { api("/api/admin/status").then((r) => setSt(r.ok ? r.json : null)); rpc(sb, "admin_rollup_status").then(({ data }) => setRs(data || null)); }, [sb]);
  const goals: D[] = Array.isArray(g.d) ? g.d : [];
  const [edit, setEdit] = useState<Record<string, string>>({});
  const [nf, setNf] = useState({ day: bpDate(), kind: "kiadas", text: "" });
  const [ne, setNe] = useState<D | null>(null);
  const [msg, setMsg] = useState("");
  /* an empty field no longer deletes; a failed save says so (it was silent) */
  const saveGoal = async (metric: string, period: string) => {
    const raw = edit[metric + period]; if (!raw) { toast("Írd be a célt (egy számot)."); return; }
    const r = await rpc(sb, "admin_goal_save", { p_metric: metric, p_period: period, p_target: Number(raw), ...(period === "custom" ? { p_start: cs, p_end: ce } : {}) });
    if (r.error) { toast(/check constraint|violates/i.test(r.error.message) ? "Ezt a célt az adatbázis még nem fogadja: telepítsd az adatbázis-frissítést." : r.error.message); return; }
    setEdit((o) => ({ ...o, [metric + period]: "" })); toast("Cél mentve"); g.load();
  };
  const delGoal = async (metric: string, period: string) => { if (!confirm(`Törlöd: ${GM[metric] || metric} (${PER[period]})?`)) return; const r = await rpc(sb, "admin_goal_save", { p_metric: metric, p_period: period, p_target: 0 }); if (r.error) toast(r.error.message); else toast("Cél törölve"); g.load(); };
  const addNote = async (e: React.FormEvent) => { e.preventDefault(); if (!nf.text.trim()) return; const r = await rpc(sb, "admin_note_save", { p_day: nf.day, p_kind: nf.kind, p_text: nf.text }); if (r.error) { toast(r.error.message); return; } setNf({ ...nf, text: "" }); nt.load(); };
  const delNote = async (id: number) => { await rpc(sb, "admin_note_delete", { p_id: id }); nt.load(); };
  const saveNote = async () => { if (!ne) return; const r = await rpc(sb, "admin_note_update", { p_id: ne.id, p_day: ne.day, p_kind: ne.kind, p_text: ne.text }); if (r.error) { toast(r.error.message); return; } setNe(null); toast("Jegyzet mentve"); nt.load(); };
  const test = async (weekly = false) => { setMsg("Küldés…"); const r = await api("/api/admin/digest" + (weekly ? "?weekly=1" : ""), { method: "POST" }); setMsg((weekly ? "Heti riport · " : "") + (r.ok ? Object.entries(r.json).filter(([k]) => k !== "ok").map(([k, v]) => `${k === "email" ? "E-mail" : "Telegram"}: ${v}`).join(" · ") : r.json?.error || "Nem sikerült.")); };
  const active = goals.length;
  /* the schedules as the database runs them (it said "bekapcsolva" whatever happened) */
  const job = (k: string) => rs?.jobs?.[k] as D | undefined;
  const jobChip = (k: string) => { const j = job(k); if (!rs) return "…"; if (!rs.jobs) return <span className="chip">nem látható</span>; if (!j) return <span className="chip bad">nincs ütemezve</span>; if (!j.active) return <span className="chip warn">kikapcsolva</span>;
    return j.last?.status === "failed" ? <span className="chip bad" title={j.last?.msg}>hiba · {ago(j.last.at)}</span> : <span className="chip good">bekapcsolva{j.last?.at ? ` · utoljára ${ago(j.last.at)}` : ""}</span>; };
  return (
    <div className="g">
      <Band plain label="Célok" value={active} unit="beállított cél" sentence={active ? <>{goals.map((x) => `${GM[x.metric] || x.metric} (${PER[x.period] || x.period}): ${fmt(x.value)} / ${fmt(x.target)}`).join(" · ")}</> : <>Állíts be heti, havi, negyedéves, éves vagy egyedi célt: a fő grafikonon megjelenik a célvonal, és a reggeli összefoglaló is jelzi, hol tartasz.</>} />
      <Milestone d={d} />
      {goals.length > 0 && <section className="c s12"><div className="grings">{goals.map((x, i) => <GoalRing key={x.metric + x.period} value={n(x.value)} target={n(x.target)} label={GM[x.metric] || x.metric} sub={`${PER[x.period] || x.period} · ${forecast(x)}`} c={["#FF4FA3", "#8B5CF6", "#2BA597", "#F2A93B", "#5B5BD6", "#FF8A5B"][i % 6]} />)}</div></section>}
      <Card className="s12" icon={P.target} title="Célok" sub="A heti cél hétfőtől, a havi a hónap elejétől, a negyedéves és az éves a negyedév és az év elejétől számít (budapesti idő); az egyedi a megadott napoktól. Az ütem: hová ér a szám a periódus végére, ha így megy tovább. Törölni a Törlés gombbal lehet.">
        {/* the goals already set, each with its progress and its past periods; a new one is set in one row below */}
        <div className="goals">{goals.map((x) => {
          const share = Math.min(1, n(x.value) / Math.max(1, n(x.target))), pc = paceOf(x), k = x.metric + x.period;
          const hist: D[] = (x.hist || []) as D[];
          return (
            <div key={k} className="goal-c on">
              <div className="goal-h"><b>{GM[x.metric] || x.metric}</b><span>{PER[x.period] || x.period}{x.period === "custom" && x.start_day ? ` · ${x.start_day}–${x.end_day}` : ""}</span></div>
              <div className="goal-v"><CountUp v={n(x.value)} /> <small>/ {fmt(x.target)}</small></div><div className="ms-bar"><i style={{ width: share * 100 + "%" }} /></div>
              <div className="goal-s">{share >= 1 ? <span style={{ color: "var(--a-good)" }}>✓ teljesítve</span> : <>ütem: ~{fmt(pc.proj)} · <span style={{ color: pc.proj >= n(x.target) ? "var(--a-good)" : "var(--a-warn)" }}>{pc.proj >= n(x.target) ? "jó úton" : "lemaradás"}</span> · {fmt(pc.left, 1)} nap van hátra</>}</div>
              {NOTE[x.metric] && <small className="note">{NOTE[x.metric]}{x.gsc_last ? ` · adat: ${x.gsc_last}-ig` : ""}</small>}
              {hist.length > 0 && <div className="goal-hist" title="Az előző periódusok">{hist.map((h, i) => { const ok = n(h.value) >= n(x.target); return <span key={i} className={ok ? "ok" : ""} title={`${new Date(h.t0).toLocaleDateString("hu-HU", { month: "short", day: "numeric" })}: ${fmt(h.value)}`}><i style={{ height: `${Math.min(100, (n(h.value) / Math.max(1, n(x.target))) * 100)}%` }} /></span>; })}<small>előző {hist.length} {PER[x.period]} periódus · {hist.filter((h) => n(h.value) >= n(x.target)).length} teljesült</small></div>}
              <div className="adm-row" style={{ gap: 6 }}><input className="adm-in sm" style={{ width: 110 }} inputMode="numeric" placeholder={String(x.target)} value={edit[k] ?? ""} onChange={(e) => setEdit({ ...edit, [k]: e.target.value.replace(/\D/g, "") })} />
                <button className="adm-ibtn sm" onClick={() => saveGoal(x.metric, x.period)} disabled={!edit[k]}>Mentés</button><button className="adm-ibtn sm" onClick={() => delGoal(x.metric, x.period)}>Törlés</button></div>
            </div>
          ); })}</div>
        <div className="goal-new">
          <select className="adm-in" value={nm} onChange={(e) => setNm(e.target.value)} aria-label="Mutató">{Object.keys(GM).map((m) => <option key={m} value={m}>{GM[m]}</option>)}</select>
          <div className="adm-seg sm" role="group">{Object.entries(PER).map(([k, l]) => <button key={k} aria-pressed={np === k} onClick={() => setNp(k)}>{l[0].toUpperCase() + l.slice(1)}</button>)}</div>
          {np === "custom" && <div className="adm-row" style={{ gap: 6 }}><input className="adm-in sm" type="date" value={cs} onChange={(e) => setCs(e.target.value)} aria-label="Kezdet" /><input className="adm-in sm" type="date" value={ce} onChange={(e) => setCe(e.target.value)} aria-label="Vége" /></div>}
          <input className="adm-in" inputMode="numeric" placeholder="cél, pl. 100" value={edit[nm + np] ?? ""} onChange={(e) => setEdit({ ...edit, [nm + np]: e.target.value.replace(/\D/g, "") })} />
          <button className="adm-ibtn gold" onClick={() => saveGoal(nm, np)} disabled={!edit[nm + np]}>Cél mentése</button>
        </div>
      </Card>
      <Card className="s12" icon={P.bolt} title="Kísérletek: előtte és utána" sub="Egy változtatás (új horog, új nyelv, új gomb) hatása. Az összevetés a lezárt napokat nézi (a mai félnapot nem), és a kezdőnap előtti ugyanolyan napokkal (ugyanazok a hét napjai) méri. Csatornára vagy nyelvre szűkíthető. Rövid időnél ez irány, nem bizonyíték.">
        <Experiments />
      </Card>
      <Card className="s7" icon={P.doc} title="Napló" sub="Jegyzetek a grafikonokra: kiadás, kampány, poszt, külső esemény (pl. Google-frissítés). A főoldali grafikonon pontként jelennek meg; a Szerkesztés gombbal javíthatók.">
        <form className="form-g" onSubmit={addNote} style={{ gridTemplateColumns: "150px 150px 1fr auto" }}>
          <label className="lf"><span>Nap</span><input className="adm-in" type="date" value={nf.day} onChange={(e) => setNf({ ...nf, day: e.target.value })} /></label>
          <label className="lf"><span>Típus</span><select className="adm-in" value={nf.kind} onChange={(e) => setNf({ ...nf, kind: e.target.value })}>{Object.entries(NOTE_KIND).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <label className="lf"><span>Mi történt</span><input className="adm-in" maxLength={200} placeholder="pl. 1.0.1 kiadás, új TikTok-sorozat" value={nf.text} onChange={(e) => setNf({ ...nf, text: e.target.value })} /></label>
          <button className="adm-ibtn gold" style={{ height: 36 }}>{I(P.plus)}Hozzáadás</button>
        </form>
        {ne && <div className="form-g note-ed" style={{ gridTemplateColumns: "150px 150px 1fr auto auto" }}>
          <input className="adm-in" type="date" value={ne.day} onChange={(e) => setNe({ ...ne, day: e.target.value })} aria-label="Nap" />
          <select className="adm-in" value={ne.kind} onChange={(e) => setNe({ ...ne, kind: e.target.value })} aria-label="Típus">{Object.entries(NOTE_KIND).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          <input className="adm-in" maxLength={200} value={ne.text} onChange={(e) => setNe({ ...ne, text: e.target.value })} aria-label="Szöveg" />
          <button className="adm-ibtn sm" onClick={() => setNe(null)}>Mégse</button><button className="adm-ibtn gold sm" onClick={saveNote}>Mentés</button>
        </div>}
        <Tbl name="naplo" rows={Array.isArray(nt.d) ? nt.d : []} empty="Még nincs jegyzet." cols={[
          { k: "day", l: "Nap", r: (r) => new Date(r.day).toLocaleDateString("hu-HU", { year: "numeric", month: "short", day: "numeric" }) },
          { k: "kind", l: "Típus", r: (r) => <span className="chip gold">{NOTE_KIND[r.kind] || r.kind}</span> },
          { k: "text", l: "Jegyzet", r: (r) => <span className="cellwrap">{r.text}</span> },
          { k: "x", l: "", r: (r) => <span className="adm-row" style={{ gap: 6 }}><button className="adm-ibtn sm" onClick={() => setNe({ id: r.id, day: String(r.day).slice(0, 10), kind: r.kind, text: r.text })}>Szerkesztés</button><button className="adm-ibtn sm" onClick={() => delNote(r.id)}>Törlés</button></span> },
        ]} />
      </Card>
      <Card className="s5" icon={P.mail} title="Reggeli összefoglaló és heti riport" sub="Minden reggel (8:00 körül) e-mail az admin-címre: a tegnapi számok, a hét, minden cél és a mai teendők; vasárnap este a heti riport. Telegramon is, ha beállítod. Az állapotot az adatbázis ütemezője adja.">
        <dl className="kv">
          <dt>E-mail (Resend)</dt><dd>{st ? (st.email ? <span className="chip good">beállítva</span> : <span className="chip bad">nincs RESEND_API_KEY</span>) : "…"}</dd>
          <dt>Reggeli küldés</dt><dd>{jobChip("admin-digest")}</dd>
          <dt>Heti riport (vasárnap)</dt><dd>{jobChip("admin-weekly")}</dd>
          <dt>Telegram</dt><dd>{st ? (st.telegram ? <span className="chip good">beállítva</span> : <span className="chip">nem kötelező: TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID</span>) : "…"}</dd>
        </dl>
        <div className="adm-row"><button className="adm-ibtn gold" onClick={() => test()}>{I(P.mail)}Próba: reggeli</button><button className="adm-ibtn" onClick={() => test(true)}>{I(P.doc)}Próba: heti riport</button>{msg && <span className="note">{msg}</span>}</div>
      </Card>
      <Card className="s12" icon={P.target} title="„Mi lenne, ha” számoló" sub="A mostani számaidból indul; húzd a csúszkákat, és látod, mikor éred el a következő mérföldköveket és az 1 milliót. Becslés, nem ígéret.">
        <WhatIf d={d} />
      </Card>
      <Card className="s12" icon={P.share} title="Befektetői / sajtó-nézet" sub="Csak olvasható oldal a fő számokkal és a heti trendekkel (emberek, e-mailek és események nélkül), egy kitalálhatatlan linken, ami lejár. Pályázathoz, befektetőnek, újságírónak.">
        <ShareLinks />
      </Card>
    </div>
  );
}

/* ---------- experiments ---------- */
const EM: Record<string, string> = { scored: "Előnézet", sessions: "Látogatás", signups: "Regisztráció", shared: "Megosztás", app: "Appmegnyitás", revealed: "Megnézte 50 év múlva", gsc_clicks: "Google-kattintás", gsc_impressions: "Google-megjelenés", downloads: "Letöltés",
  ...Object.fromEntries(SOC.flatMap((p) => [[`followers_${p}`, `${PF[p]}: új követő`], [`views_${p}`, p === "pinterest" ? "Pinterest: megjelenés" : `${PF[p]}: új megtekintés`]])) };
/* only these follow a channel or language filter (the daily summary has them per channel and language) */
const EM_FLT = new Set(["scored", "sessions", "shared", "app", "revealed"]);
const CHS = ["tiktok", "instagram", "facebook", "pinterest", "linkedin", "youtube", "google", "ai", "közvetlen", "hivatkozás", "kereső"];
function Experiments() {
  const sb = useMemo(() => supabaseBrowser(), []);
  const { d, load } = useRpc("admin_experiments_list", undefined, []);
  const [f, setF] = useState({ title: "", start_day: bpDate(), metric: "scored", days: 7, ch: "", lg: "", note: "" });
  const [noteE, setNoteE] = useState<{ id: number; note: string } | null>(null);
  const add = async (e: React.FormEvent) => { e.preventDefault(); if (!f.title.trim()) return; const r = await rpc(sb, "admin_experiment_save", { p: { ...f, ch: EM_FLT.has(f.metric) ? f.ch : "", lg: EM_FLT.has(f.metric) ? f.lg : "" } }); if (r.error) { toast(r.error.message); return; } setF({ ...f, title: "", note: "" }); load(); };
  const saveNote = async () => { if (!noteE) return; const r = await rpc(sb, "admin_experiment_save", { p: { id: noteE.id, note: noteE.note } }); if (r.error) { toast(r.error.message); return; } setNoteE(null); toast("Jegyzet mentve"); load(); };
  const rows: D[] = Array.isArray(d) ? d : [];
  return (
    <>
      <form className="form-g" onSubmit={add} style={{ gridTemplateColumns: "1fr 140px 170px 90px auto" }}>
        <label className="lf"><span>Mit változtattál</span><input className="adm-in" value={f.title} maxLength={200} placeholder="pl. új horog: „Így néz ki a tetoválásom 50 év múlva”" onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
        <label className="lf"><span>Kezdőnap</span><input className="adm-in" type="date" value={f.start_day} onChange={(e) => setF({ ...f, start_day: e.target.value })} /></label>
        <label className="lf"><span>Mit mérünk</span><select className="adm-in" value={f.metric} onChange={(e) => setF({ ...f, metric: e.target.value })}>{Object.entries(EM).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label className="lf"><span>Napok</span><input className="adm-in" type="number" min={1} max={60} value={f.days} onChange={(e) => setF({ ...f, days: Number(e.target.value) || 7 })} /></label>
        <button className="adm-ibtn gold" style={{ height: 36 }}>{I(P.plus)}Indítás</button>
        {EM_FLT.has(f.metric) && <label className="lf"><span>Csatorna (nem kötelező)</span><select className="adm-in" value={f.ch} onChange={(e) => setF({ ...f, ch: e.target.value })}><option value="">mind</option>{CHS.map((k) => <option key={k} value={k}>{ch(k)}</option>)}</select></label>}
        {EM_FLT.has(f.metric) && <label className="lf"><span>Nyelv (nem kötelező)</span><select className="adm-in" value={f.lg} onChange={(e) => setF({ ...f, lg: e.target.value })}><option value="">mind</option>{Object.entries(LANGS).filter(([k]) => k !== "?" && k !== "nb").map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>}
        <label className="lf" style={{ gridColumn: "span 3" }}><span>Jegyzet (nem kötelező)</span><input className="adm-in" maxLength={500} value={f.note} placeholder="pl. mit vársz, mit figyelsz" onChange={(e) => setF({ ...f, note: e.target.value })} /></label>
      </form>
      <Tbl name="kiserletek" rows={rows} empty="Még nincs kísérlet." cols={[
        { k: "title", l: "Kísérlet", r: (r) => <span className="cellwrap"><b>{r.title}</b><br /><span className="mut">{new Date(r.start_day).toLocaleDateString("hu-HU", { month: "short", day: "numeric" })}-tól {r.days} nap · {EM[r.metric] || r.metric}{r.ch ? ` · ${ch(r.ch)}` : ""}{r.lg ? ` · ${LANGS[r.lg] || r.lg}` : ""}</span>
          {noteE && noteE.id === r.id ? <span className="adm-row" style={{ gap: 6, marginTop: 6 }}><input className="adm-in sm" value={noteE.note} maxLength={500} onChange={(e) => setNoteE({ id: r.id, note: e.target.value })} /><button className="adm-ibtn sm" onClick={saveNote}>Mentés</button></span>
            : <><br /><span className="mut">{r.note || ""}</span> <button className="lnk" onClick={() => setNoteE({ id: r.id, note: r.note || "" })}>{r.note ? "jegyzet szerkesztése" : "+ jegyzet"}</button></>}</span> },
        { k: "v_before_dow", l: "Előtte (ugyanazok a napok)", num: true, r: (r) => n(r.gone) > 0 ? fmt(r.v_before_dow) : "–" }, { k: "v_after", l: "Utána", num: true, r: (r) => n(r.gone) > 0 ? <b>{fmt(r.v_after)}</b> : "–" },
        /* finished days only, against the same weekdays before: no giant percentage on the first day */
        { k: "x", l: "Változás", num: true, r: (r) => { if (n(r.gone) < 1) return <span className="mut">holnaptól látszik</span>; const b = n(r.v_before_dow), a = n(r.v_after); const c2 = b ? ((a - b) / b) * 100 : null;
          return c2 == null ? "–" : <span className={c2 >= 0 ? "up" : "down"}>{c2 >= 0 ? "+" : ""}{fmt(c2)}%{!r.done ? ` (${fmt(r.gone)} lezárt nap)` : ""}</span>; } },
        { k: "done", l: "", r: (r) => (r.done ? <span className="chip good">lezárult</span> : <span className="chip">{fmt(r.gone)} / {fmt(r.days)} nap</span>) },
        { k: "del", l: "", r: (r) => <button className="adm-ibtn sm" onClick={async () => { if (!confirm("Törlöd a kísérletet?")) return; await rpc(sb, "admin_experiment_delete", { p_id: r.id }); load(); }}>Törlés</button> },
      ]} />
    </>
  );
}

/* ---------- the last milestone, as a card to share ---------- */
const MS = [50, 100, 250, 500, 1_000, 2_500, 5_000, 10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000];
function Milestone({ d }: { d: D }) {
  /* the milestone is the real total: with a channel or language filter on, the dashboard's numbers are the filtered ones */
  const filtered = !!(d.filter?.ch || d.filter?.lang);
  const g = useRpc("admin_grand_total", undefined, [filtered]);
  const sc = filtered && g.d ? n((g.d as D).scored) : n(d.all?.scored), m = [...MS].reverse().find((x) => sc >= x);
  if (!m) return null;
  /* the card's fonts are loaded before drawing (a canvas does not wait for them, and fell back to a plain serif) */
  const card = async () => {
    try { await Promise.all(["italic 600 96px 'Cormorant Garamond'", "600 230px 'Cormorant Garamond'", "500 60px Geist", "400 38px Geist"].map((f) => document.fonts.load(f))); } catch {}
    const c = document.createElement("canvas"); c.width = 1080; c.height = 1350; const x = c.getContext("2d")!;
    const g = x.createLinearGradient(0, 0, 0, 1350); g.addColorStop(0, "#F7F3EA"); g.addColorStop(1, "#E9DFCB"); x.fillStyle = g; x.fillRect(0, 0, 1080, 1350);
    x.fillStyle = "#1A1714"; x.textAlign = "center"; x.font = "italic 600 96px 'Cormorant Garamond', Georgia, serif"; x.fillText("InkAge", 540, 220);
    x.font = "600 230px 'Cormorant Garamond', Georgia, serif"; x.fillText(m.toLocaleString("hu-HU"), 540, 720);
    x.font = "500 60px Geist, system-ui, sans-serif"; x.fillStyle = "#8A6A2C"; x.fillText("kész előnézet", 540, 830);
    x.font = "400 38px Geist, system-ui, sans-serif"; x.fillStyle = "#6E655A"; x.fillText("Köszönjük! · inkage.app", 540, 1180);
    const a = document.createElement("a"); a.href = c.toDataURL("image/png"); a.download = `inkage-${m}.png`; a.click();
  };
  return <section className="c s12 ms-card"><div><span className="eyebrow">Az utolsó mérföldkő</span><h2>{m.toLocaleString("hu-HU")} kész előnézet</h2><p className="note">A következő: {(MS.find((x) => x > sc) || 1_000_000).toLocaleString("hu-HU")}. Oszd meg a sikert: egy kép Instagramra, LinkedInre.</p></div><button className="adm-ibtn gold" onClick={card}>{I(P.share)}Megosztható kártya (PNG)</button></section>;
}
