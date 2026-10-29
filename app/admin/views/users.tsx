"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { BarList, Donut, Empty, Spark, fmt, pct, SERIES } from "../charts";
import { PeopleGrid } from "../wow";
import { LANG_LAND, flag } from "../visuals";
import { Band, Card, EV, Kpi, LANGS, P, PF, PROV, QSTEP, QVAL, SCR, SIGN, CELEB, pageName, styleName, Tbl, ago, ch, dt, lang, n, periodName, periodWords, rpc, type D, Layer, useBlockPeriod, useFlt, useRpc } from "../shared";
import { Logo, dur } from "../wow";
import { per } from "./traffic";
import { Activation, PeopleToday, ScoreChip, STAGE, StageChip, StageLesson, UserMore } from "./people";

const PFL: Record<string, string> = { web: "Weboldal", android: "Android-app (becslés)", ismeretlen: "Nem párosítható" };
const MATCH_NOTE = "A forrás becslés: a regisztrációt az időben legközelebbi, azonos nyelvű névtelen látogatáshoz kötjük (a mérés fiókot nem tárol). Az iPhone-appból jöttek nem párosíthatók, mert az app nem küld adatot.";

/* ---------- users ---------- */
export function Users({ d }: { d: D }) {
  /* the header's channel and language filter starts the page's own pickers (and follows it when it changes) */
  const { f: gf } = useFlt();
  /* the list and the leads by registration time, each with its own period picker ("Mint fölül" by default) */
  const lp = useBlockPeriod(), ld = useBlockPeriod();
  const [fl, setFl] = useState<{ lang: string; prov: string; ch: string }>({ lang: gf.lang || "", prov: "", ch: gf.ch || "" });
  useEffect(() => { setFl((o) => ({ ...o, lang: gf.lang || "", ch: gf.ch || "" })); }, [gf.ch, gf.lang]);
  /* the language, sign-in and source pickers filter the numbers at the top too (they only filtered the list) */
  const { d: S } = useRpc("admin_users_stats", { ...per(d), p_lang: fl.lang || null, p_provider: fl.prov || null, p_ch: fl.ch || null }, [d.days, d.from, fl.lang, fl.prov, fl.ch]);
  const U: D = S || {};
  const sb = useMemo(() => supabaseBrowser(), []);
  const [q, setQ] = useState(""); const [filter, setFilter] = useState("all"); const [page, setPage] = useState(0); const [sort, setSort] = useState("created"); const [ver, setVer] = useState(0);
  const [rows, setRows] = useState<D | null>(null); const [open, setOpen] = useState<string | null>(null); const [uv, setUv] = useState<"cards" | "table">("cards");
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { setPage(0); }, [lp.args.p_days, lp.args.p_from, lp.args.p_to]);
  useEffect(() => {
    if (t.current) clearTimeout(t.current);
    /* every account with its score and stage (admin_people); the old fields keep their names for the cards and the CSV */
    t.current = setTimeout(async () => {
      const { data } = await rpc(sb, "admin_people", { p_q: q, p_limit: 25, p_offset: page * 25, p_filter: filter, p_lang: fl.lang || null, p_provider: fl.prov || null, p_ch: fl.ch || null, p_sort: sort, ...lp.args });
      const r = (data as D) || {};
      setRows({ ...r, rows: ((r.rows || []) as D[]).map((x) => ({ ...x, unlocks: x.unl_all, gift_claimed: x.gift, active_days: x.days30, last_active: x.last_active_at, is_admin: x.own })) });
    }, 250);
  }, [sb, q, filter, page, fl, sort, ver, lp.args.p_days, lp.args.p_from, lp.args.p_to]);
  /* new sign-ups and what they are doing show up by themselves: the list reloads every 20 seconds while the page is in view */
  useEffect(() => { const iv = setInterval(() => { if (document.visibilityState === "visible") setVer((x) => x + 1); }, 20_000); return () => clearInterval(iv); }, []);
  const C: D = rows?.counts || {};
  /* the confirmed and returned shares of the accounts registered in the period (the all-time ones until the database has them) */
  const cf = n(U.confirmed_p ?? U.confirmed), uc = n(U.unconfirmed_p ?? U.unconfirmed), cfBase = U.confirmed_p != null ? n(U.signups) : n(U.total);
  const r1 = n(U.returned_1d_p ?? U.returned_1d), e1 = n(U.eligible_1d_p ?? U.eligible_1d), r7 = n(U.returned_7d_p ?? U.returned_7d), e7 = n(U.eligible_7d_p ?? U.eligible_7d);
  let acc = 0; const cum = ((U.cum || []) as D[]).map((x) => (acc += n(x.n)));
  const sources: D[] = U.sources || [], sourcesAll: D[] = U.sources_all || sources;
  /* the list's CSV without e-mail addresses or names (the table shows them, the file does not carry them) */
  const csv = () => {
    const cols: [string, string][] = [["created_at", "Regisztrált"], ["provider", "Mód"], ["confirmed", "Megerősítve"], ["lang", "Nyelv"], ["ch", "Forrás (becslés)"], ["score", "Pontszám"], ["stage", "Életciklus"], ["churn", "Lemorzsolódhat"], ["unlocks", "Mentett előnézetek"], ["credits", "Bónusz előnézet"], ["gift_claimed", "–"], ["active_days", "Aktív napok (30)"], ["last_active", "Utoljára aktív"], ["tags", "Címkék"]];
    const esc = (v: unknown) => { const s = v == null ? "" : String(v); return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const body = [cols.map((c) => c[1]).join(";"), ...((rows?.rows || []) as D[]).map((r) => cols.map(([k]) => esc(r[k])).join(";"))].join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿" + body], { type: "text/csv;charset=utf-8" })); a.download = `fiokok-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  return (
    <div className="g">
      <Band plain label={`Új fiókok ${periodName(d)}`} value={n(U.signups)} unit={`összesen ${fmt(U.total)} regisztrált fiók`} now={n(U.signups)} prev={n(U.signups_prev)} sentence={<>Az időszakban regisztráltak közül <b>{pct(cf, cfBase)}</b> megerősítette az e-mailjét, és <b>{pct(r1, e1)}</b> visszatért legalább egy nap múlva; az összes fiókból <b>{fmt(U.active_7)}</b> volt aktív az elmúlt 7 napban. Aktív = volt aktív napja (belépés vagy használat), ugyanúgy, mint a Megtartás oldalon; a heti kohorszok is ott vannak. A saját és tesztfiókjaid egyik számban sincsenek benne (a listában a „Saját és teszt” gomb mutatja őket); a nyelv-, belépés- és forrásszűrő a fenti számokra is hat. A „ma” budapesti nap.</>} side={<Spark values={cum} h={92} />} />
      <Kpi kind="own" to="retention" tone="butter" className="s4" icon={P.check} l="Megerősített" v={pct(cf, cfBase)} sub={<span>{fmt(uc)} nincs megerősítve · medián {U.confirm_median_min != null ? fmt(n(U.confirm_median_min), 1) + " perc" : U.confirm_median_all != null ? fmt(n(U.confirm_median_all), 1) + " perc (összes)" : "–"}</span>} title="Az időszakban regisztrált fiókok közül. A medián: a regisztrációtól az e-mail megerősítéséig eltelt idő az időszakban regisztráltaknál." />
      <Kpi kind="own" to="retention" tone="pink" className="s4" icon={P.bolt} l="Aktív 7 napban" v={fmt(U.active_7)} sub={<span>ma: {fmt(U.active_1)} · 30 nap: {fmt(U.active_30)}</span>} title="Aktív nap: belépés vagy munkamenet-frissítés a fiókkal (mint a Megtartás oldalon)." />
      <Kpi kind="own" to="retention" tone="sky" className="s4" icon={P.refresh} l="Visszatért 1 nap után" v={pct(r1, e1)} sub={<span>7 nap után: {pct(r7, e7)}</span>} title="Az időszakban regisztrált fiókok közül azok, akik legalább 1 (7) nappal a regisztráció után újra aktívak voltak; a ma regisztráltak még nem számítanak." />

      <Card className="s3" icon={P.user} title="Regisztráció módja" sub={`Az időszakban regisztráltak (${fmt(U.signups)} fiók).`}><Donut items={(U.providers || []).map((x: D) => ({ k: x.k, n: n(x.n) }))} center={fmt(U.signups)} sub="új fiók" label={(k) => PROV[k] || k} color={(k) => ({ email: SERIES[0], google: SERIES[2], apple: SERIES[6] } as D)[k] || "#6E6E73"} size={140} /></Card>
      <Card className="s3" icon={P.globe} title="Fiókok nyelve" sub="Az időszakban regisztráltak. A Google- és Apple-fiókok nyelvet nem mentenek: náluk a regisztráló látogatás nyelve (becslés)."><BarList items={(U.langs || []).map((x: D) => ({ k: x.k, n: n(x.n) }))} fmtK={lang} max={7} /></Card>
      <Card className="s3" icon={P.target} title="Honnan regisztráltak" sub={MATCH_NOTE}><BarList items={sources.map((x: D) => ({ k: x.k, n: n(x.n) }))} fmtK={(k) => (k === "ismeretlen" ? "Nem párosítható" : ch(k))} /><span className="note">{fmt(U.matched)} / {fmt(U.signups)} párosítva</span></Card>
      <Card className="s3" icon={P.eye} title="Honnan: platform" sub="A regisztráló látogatás alapján (becslés)."><BarList items={(U.platforms || []).map((x: D) => ({ k: x.k, n: n(x.n) }))} fmtK={(k) => PFL[k] || k} /></Card>

      <Card className="s12" icon={P.users} title="Felhasználók" sub={`Fiókok, ${periodWords(lp.p)} regisztráltak (a blokk időszaka alapból ugyanaz, mint fölül; „Összes”: minden fiók). Keresés e-mailre, névre vagy azonosítóra, szűrés nyelvre, belépési módra és forrásra; a gombok számai is az időszak fiókjai. Kattints egy sorra a részletekért. A CSV e-mail-cím és név nélkül készül.`} right={<>{lp.ctl}<span className="chip gold">{fmt(rows?.total)} találat</span><button className="lnk" onClick={csv}>CSV ⤓</button></>}>
        <div className="adm-row">
          <input className="adm-in" style={{ flex: "1 1 260px" }} placeholder="Keresés: e-mail, név, azonosító…" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
          <select className="adm-in sm" value={sort} onChange={(e) => { setSort(e.target.value); setPage(0); }} aria-label="Sorrend"><option value="created">Legújabb elöl</option><option value="score">Pontszám szerint</option><option value="active">Utoljára aktív</option></select>
        </div>
        {/* the stages and the to-do filters, each with its count (the numbers leave out your own accounts) */}
        <div className="adm-seg sm" style={{ flexWrap: "wrap" }}>
          {([["all", "Mind", null], ["followup", "Visszakeresés", C.followup], ["churn", "Lemorzsolódhat", C.churn], ["stuck", "Elakadt", C.stuck], ["uj", STAGE.uj[0], C.uj], ["probalgatja", STAGE.probalgatja[0], C.probalgatja], ["aktiv", STAGE.aktiv[0], C.aktiv],
            ["veszelyben", STAGE.veszelyben[0], C.veszelyben], ["alvo", STAGE.alvo[0], C.alvo], ["online", "Most aktív", C.online], ["unconfirmed", "Nem megerősített", null], ["unlocked", "Van mentett előnézete", null], ["banned", "Felfüggesztve", C.banned],
            ["own", "Saját és teszt", rows?.own]] as [string, string, unknown][]).map(([k, l, c]) => (
            <button key={k} aria-pressed={filter === k} onClick={() => { setFilter(k); setPage(0); }}>{l}{c != null && n(c) > 0 ? ` · ${fmt(n(c))}` : ""}</button>
          ))}
        </div>
        {(rows?.tags || []).length > 0 && <div className="adm-row" style={{ gap: 6, flexWrap: "wrap" }}>{(rows!.tags as D[]).map((t) => <button key={t.k} className={"chip" + (filter === "tag:" + t.k ? " gold" : "")} onClick={() => { setFilter(filter === "tag:" + t.k ? "all" : "tag:" + t.k); setPage(0); }}>#{t.k} · {fmt(t.n)}</button>)}</div>}
        <div className="adm-row">
          <select className="adm-in sm" value={fl.lang} onChange={(e) => { setFl({ ...fl, lang: e.target.value }); setPage(0); }}><option value="">Minden nyelv</option>{Object.keys(LANGS).filter((k) => k !== "?" && k !== "nb").map((k) => <option key={k} value={k}>{LANGS[k]}</option>)}</select>
          <select className="adm-in sm" value={fl.prov} onChange={(e) => { setFl({ ...fl, prov: e.target.value }); setPage(0); }}><option value="">Minden belépési mód</option>{Object.entries(PROV).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          <select className="adm-in sm" value={fl.ch} onChange={(e) => { setFl({ ...fl, ch: e.target.value }); setPage(0); }}><option value="">Minden forrás</option>{sourcesAll.map((x) => <option key={x.k} value={x.k}>{x.k === "ismeretlen" ? "Nem párosítható" : ch(x.k)}</option>)}</select>
          <div className="adm-seg sm"><button aria-pressed={uv === "cards"} onClick={() => setUv("cards")}>Kártyák</button><button aria-pressed={uv === "table"} onClick={() => setUv("table")}>Táblázat</button></div>
        </div>
        {!rows ? <div className="skel" style={{ height: 200 }} /> : uv === "cards" ? (
          (rows.rows || []).length ? <PeopleGrid rows={rows.rows} onOpen={setOpen} prov={(k) => PROV[k] || k} langName={lang} flag={(k) => flag((LANG_LAND[String(k || "").slice(0, 2)] || [])[0])} ago={ago} /> : <Empty t={`Nincs találat ${periodWords(lp.p)}.`} />
        ) : (
          <Tbl rows={rows.rows || []} onRow={(x) => setOpen(x.id)} csv={false} empty={`Nincs találat ${periodWords(lp.p)}.`} cols={[
            { k: "email", l: "Fiók", r: (x) => <div style={{ display: "flex", gap: 10, alignItems: "center" }}><span className="pfh-av" style={{ width: 30, height: 30, borderRadius: 99, fontSize: 12, background: "var(--a-s3)", color: "var(--a-gold)" }}>{(x.email || "?").slice(0, 1).toUpperCase()}</span><div><b>{x.email || "–"}</b>{x.is_admin && <span className="chip gold" style={{ marginLeft: 8 }}>admin</span>}<div className="mut" style={{ fontSize: 12 }}>{x.name || "névtelen"}</div></div></div> },
            { k: "score", l: "Pontszám", num: true, r: (x) => <ScoreChip s={n(x.score)} /> },
            { k: "stage", l: "Életciklus", r: (x) => <span style={{ display: "inline-flex", gap: 4, flexWrap: "wrap" }}><StageChip k={x.stage} />{x.churn && <span className="chip warn">lemorzsolódhat</span>}{x.online && <span className="chip good">● most</span>}{x.banned && <span className="chip bad">felfüggesztve</span>}{(x.tags || []).map((t: string) => <span key={t} className="chip">#{t}</span>)}</span> },
            { k: "provider", l: "Mód", r: (x) => <span className="chip">{PROV[x.provider] || x.provider}</span> },
            { k: "confirmed", l: "Állapot", r: (x) => x.confirmed ? <span className="chip good">megerősítve</span> : <span className="chip warn">nincs megerősítve</span> },
            { k: "lang", l: "Nyelv", r: (x) => <>{lang(x.lang || "?")}{x.lang_from_visit && <small className="mut" title="A látogatás nyelve (a fiók nem mentett nyelvet)"> *</small>}</> },
            { k: "ch", l: "Forrás", r: (x) => (x.ch ? <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><Logo k={x.ch} size={18} />{ch(x.ch)}</span> : <span className="mut">–</span>) },
            { k: "unlocks", l: "Mentett előnézetek", num: true, r: (x) => <>{fmt(x.unlocks)}{x.last_unlock && <small className="mut"> · {ago(x.last_unlock)}</small>}</> },
            { k: "credits", l: "Bónusz előnézet", num: true, r: (x) => fmt(x.credits) },
            { k: "gift_claimed", l: "–", r: (x) => (x.gift_claimed ? "✓" : "–") },
            { k: "welcomed", l: "Üdvözlés", r: (x) => (x.welcomed ? <span title={dt(x.welcome_at)}>✓</span> : <span className="mut">–</span>) },
            { k: "active_days", l: "Aktív napok", num: true, r: (x) => fmt(x.active_days) },
            { k: "created_at", l: "Regisztrált", r: (x) => <span title={dt(x.created_at)}>{ago(x.created_at)}</span> },
            { k: "last_active", l: "Utoljára aktív", r: (x) => (x.last_active ? ago(x.last_active) : "–") },
          ]} />
        )}
        {rows && n(rows.total) > 25 && (
          <div className="pager"><span>{page * 25 + 1}–{Math.min(n(rows.total), (page + 1) * 25)} / {fmt(rows.total)}</span>
            <div className="adm-row"><button className="adm-ibtn" disabled={!page} onClick={() => setPage(page - 1)}>← Előző</button><button className="adm-ibtn" disabled={(page + 1) * 25 >= n(rows.total)} onClick={() => setPage(page + 1)}>Következő →</button></div></div>
        )}
      </Card>
      <div className="s12"><StageLesson /></div>
      <PeopleToday open={setOpen} />
      <Activation />
      <Card right={ld.ctl} className="s12" icon={P.target} title="Leadek: honnan jött minden regisztráció" sub={`Minden regisztráció ${periodWords(ld.p)}: a csatorna, a rövid link, a poszt, ami hozta, és hogy eljutott-e az előnézetig, megosztott-e. E-mail nélkül; CSV-be menthető. ${MATCH_NOTE}`}>
        <Leads args={ld.args} ch={fl.ch} lg={fl.lang} />
      </Card>
      {open && <UserDrawer id={open} close={() => setOpen(null)} changed={() => setVer((x) => x + 1)} />}
    </div>
  );
}

export function Heat({ a, b }: { a: any; b: any }) {
  const r = n(b) ? n(a) / n(b) : 0;
  return <span className="hm" style={{ background: `color-mix(in srgb, var(--acc) ${Math.round(6 + r * 70)}%, transparent)`, color: r > 0.45 ? "#fff" : "var(--a-fg)" }}>{n(b) ? pct(n(a), n(b)) : "–"}</span>;
}

/* ---------- the user's page: what the sign-up visit did, in plain sentences ----------
   One row per thing to know (✓ done, ○ not), the pages and screens looked at in order with their time, the intro answers,
   and the AI images against the daily allowance. All from admin_user (visit, celeb, timeline). */
function Row({ ok, warn, children, sub }: { ok?: boolean; warn?: boolean; children: ReactNode; sub?: ReactNode }) {
  return (
    <li style={{ display: "grid", gridTemplateColumns: "26px 1fr", gap: 10, padding: "9px 0", borderBottom: "1px solid var(--a-line, rgba(127,127,127,.15))" }}>
      <span aria-hidden="true" style={{ width: 22, height: 22, borderRadius: 99, display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700, background: warn ? "color-mix(in srgb, #F2A93B 22%, transparent)" : ok ? "color-mix(in srgb, #2BA597 22%, transparent)" : "var(--a-s3)", color: warn ? "#F2A93B" : ok ? "#2BA597" : "var(--a-dim)" }}>{warn ? "!" : ok ? "✓" : "–"}</span>
      <span style={{ fontSize: 14, lineHeight: 1.45 }}>{children}{sub ? <span style={{ display: "block", fontSize: 12.5, color: "var(--a-dim)", marginTop: 2 }}>{sub}</span> : null}</span>
    </li>
  );
}

/* the app's steps (flow_step) as the person saw them: the intro questions are one screen, "analysis" fires with the reveal */
const QUIZ = new Set(["use", "imp", "spd", "hand", "pain", "share", "prof", "gender", "style", "leg", "occasion", "age", "feel", "len"]);
const stepName = (k: unknown) => { const s = String(k || ""); return QUIZ.has(s) ? "Bevezető kérdések" : ({ name: "Kezdés", sign: "Bőrfotó", scan: "Előnézet készül", score: "Előnézet", reveal: "Eredmény: 50 év múlva", swipe: "Eredmény: kedvencek", picks: "Eredmény: kedvencek", detail: "Eredmény: mentés" } as Record<string, string>)[s] || QSTEP[s] || s; };

const hm = (t: string) => new Date(t).toLocaleTimeString("hu-HU", { hour: "2-digit", minute: "2-digit" });

function Journey({ u }: { u: D }) {
  const v: D | null = u.visit || null, cu: D = u.celeb || {}, tl: D[] = u.timeline || [];
  const daily = n(cu.daily || 10), used = n(cu.used24);
  /* the pages in the order they were seen: website pages by their path, app screens by screen_time (or, before that was
     measured, by the steps), one row per stay; a screen seen twice in a row is one row */
  const pages: { k: string; at: string; secs?: number }[] = [];
  const timed = tl.some((y) => y.name === "screen_time");
  for (const y of tl) {
    let k = "", secs: number | undefined;
    if (y.name === "landing_view" && y.path !== "/app") k = pageName(y.path);
    else if (timed && y.name === "screen_time") { k = "App · " + (SCR[y.detail] || y.detail); secs = n(y.secs); }
    else if (!timed && y.name === "flow_step" && y.detail !== "analysis") k = "App · " + stepName(y.detail);
    if (!k) continue;
    const last = pages[pages.length - 1];
    if (last && last.k === k) { if (secs != null) last.secs = n(last.secs) + secs; continue; }
    pages.push({ k, at: timed && y.name === "screen_time" ? new Date(Date.parse(y.created_at) - n(y.secs) * 1000).toISOString() : y.created_at, secs });
  }
  const answers = tl.filter((y) => y.name === "quiz_answer" && y.val && y.detail !== "style");
  if (!v) return <><h3>Mit csinált</h3><Empty t="A regisztráló látogatás nem párosítható (iPhone-app, vagy a mérés nem látta)." /></>;
  return (
    <>
      <h3>Mit csinált{v.live && <span className="chip good" style={{ marginLeft: 8 }}>● most is bent van</span>}</h3>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        <Row ok sub={`${hm(v.first_at)} – ${hm(v.last_at)} · ${dt(v.first_at)}`}><b>{dur(v.secs)}</b> volt az oldalon</Row>
        <Row ok={v.captured} warn={v.skipped} sub={v.captured ? SIGN[v.sign] || undefined : undefined}>{v.captured ? (v.sign === "photo" ? "Feltöltött egy bőrfotót (fotóról kivágott mintával)" : "Feltöltött egy bőrfotót") : v.skipped ? "Kihagyta a bőrfotót" : v.opened ? "Nem jutott el a bőrfotóig" : "Nem nyitotta meg az appot"}</Row>
        <Row ok={v.scored}>{v.scored ? "Megkapta az előnézetet" : "Nem kapta meg az előnézetet"}</Row>
        <Row ok={!!v.style} sub={v.quiz ? "a bevezető kérdéseknél" : undefined}>Választott stílus: <b>{styleName(v.style)}</b></Row>
        <Row ok={n(cu.total) > 0} warn={used >= daily} sub={n(cu.total) ? <>Napi keret: <b>{used} / {daily}</b> felhasználva az elmúlt 24 órában{used >= daily ? " · elfogyott" : ` · még ${Math.max(0, daily - used)}`}{cu.last_at ? ` · utoljára ${ago(cu.last_at)}` : ""}</> : undefined}>
          {n(cu.total) ? <>Elkészült <b>{fmt(cu.total)} MI-képe</b>{(cu.looks || []).length ? <> ({(cu.looks as D[]).map((x) => `${CELEB[x.k] || x.k} ×${x.n}`).join(", ")})</> : null}{n(cu.ok) < n(cu.total) ? `, ebből ${fmt(cu.ok)} sikeres` : ""}</> : "Nem készített MI-képet"}
        </Row>
        <Row ok={v.revealed} sub={v.timed ? `Az eredményen töltött idő: ${dur(v.result_secs)}` : v.revealed ? "Az eredményen töltött időt akkor még nem mértük" : undefined}>{v.revealed ? "Megnézte 50 év múlva" : "Nem nézte meg 50 év múlva"}</Row>
        <Row ok={n(v.detail) > 0 || n(v.files) > 0}>{n(v.detail) ? `${fmt(v.detail)} előnézetet mentett el` : "Nem mentett el előnézetet"}{n(v.files) ? `, ${fmt(v.files)} fájlt letöltött` : ", nem töltött le fájlt"}</Row>
        <Row ok={v.shared}>{v.shared ? "Megosztotta" : "Nem osztotta meg"}</Row>
        {n(v.shots) > 0 && <Row warn sub={v.shot_scr ? `ezen a képernyőn: ${SCR[v.shot_scr] || v.shot_scr}` : undefined}>📸 {fmt(v.shots)} képernyőkép-gombot nyomott (számítógépen)</Row>}
        {n(v.errors) > 0 && <Row warn>{fmt(v.errors)} hiba történt nála</Row>}
        <Row sub={ago(v.last_at)}>Itt hagyta abba: <b>{v.last_scr ? SCR[v.last_scr] || v.last_scr : v.last_step ? stepName(v.last_step) : "–"}</b>{v.left_how === "hidden" ? " · bezárta vagy elhagyta az oldalt" : ""}</Row>
      </ul>

      <h3>Megnézett oldalak ({pages.length})</h3>
      {pages.length ? (
        <ol style={{ margin: 0, paddingLeft: 22 }}>
          {pages.map((p, i) => (
            <li key={i} style={{ padding: "5px 0", fontSize: 14 }}>
              <span>{p.k}</span>
              <small className="mut" style={{ marginLeft: 8 }}>{hm(p.at)}{p.secs != null ? ` · ${dur(p.secs)}` : ""}</small>
            </li>
          ))}
        </ol>
      ) : <Empty t="Nincs mért oldal." />}
      {!timed && pages.length > 0 && <p className="note">Az oldalakon töltött időt 2026. okt. 25. délutántól mérjük; ennél a látogatásnál csak a sorrend látszik.</p>}

      {answers.length > 0 && <>
        <h3>Válaszai a bevezető kérdésekre</h3>
        <dl className="kv">
          {answers.map((y, i) => <Fragment key={i}><dt>{QSTEP[y.detail] || y.detail}</dt><dd>{String(y.val).split("+").map((w) => QVAL[w] || w).join(", ")}</dd></Fragment>)}
        </dl>
      </>}
    </>
  );
}

export function UserDrawer({ id, close, changed }: { id: string; close: () => void; changed?: () => void }) {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [u, setU] = useState<D | null>(null); const [uv, setUv] = useState(0);
  useEffect(() => { rpc(sb, "admin_user", { p_id: id }).then(({ data }) => setU(data as D)); }, [sb, id, uv]);
  /* the open card follows the visit live: reloaded every 10 seconds while the page is in view */
  useEffect(() => { const iv = setInterval(() => { if (document.visibilityState === "visible") rpc(sb, "admin_user", { p_id: id }).then(({ data }) => data && setU(data as D)); }, 10_000); return () => clearInterval(iv); }, [sb, id]);
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === "Escape" && close(); addEventListener("keydown", k); return () => removeEventListener("keydown", k); }, [close]);
  const x = u?.user || {}, m = x.meta || {}, mt: D | null = u?.match || null;
  const src = mt?.src || m.src;
  return (
    <Layer>
      <div className="scrim" onClick={close} />
      <aside className="drawer" role="dialog" aria-label="Felhasználó">
        <div className="c-h"><div><div><span className="eyebrow">Felhasználó</span><h2 style={{ fontSize: 20, marginTop: 6 }}>{x.email || "…"}</h2></div></div><button className="adm-ibtn" onClick={close}>Bezárás</button></div>
        {!u ? <div className="skel" style={{ height: 240 }} /> : !u.user ? <Empty t="Ez a fiók már nem létezik (törölve)." /> : (
          <>
            {/* what the visit did comes first: it is what this page is opened for */}
            <Journey u={u} />
            <UserMore id={id} email={x.email || ""} lang={m.lang || mt?.lang} reload={() => { setUv((v) => v + 1); changed?.(); }} />
            <h3>Fiók</h3>
            <dl className="kv">
              <dt>Név</dt><dd>{m.display_name || m.full_name || m.name || "–"}</dd>
              <dt>Regisztrált</dt><dd>{dt(x.created_at)}</dd>
              <dt>Utoljára belépett</dt><dd>{dt(x.last_sign_in_at)} ({ago(x.last_sign_in_at)})</dd>
              <dt>Belépés módja</dt><dd>{PROV[x.provider] || x.provider}</dd>
              <dt>E-mail megerősítve</dt><dd>{x.email_confirmed_at ? dt(x.email_confirmed_at) : x.provider !== "email" ? "nem kell (" + (PROV[x.provider] || x.provider) + ")" : <span className="chip warn">még nem</span>}</dd>
              <dt>Nyelv</dt><dd>{lang(m.lang || mt?.lang || "?")}{!m.lang && mt?.lang ? <small className="mut"> (a regisztráló látogatásból)</small> : null}</dd>
              <dt>Forrás</dt><dd>{mt ? <><span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><Logo k={mt.ch} size={16} />{ch(mt.ch)}</span> · {PFL[mt.pf] || mt.pf}{src ? <small className="mut"> · {Object.entries(src).map(([k, v]) => `${k}: ${v}`).join(" · ")}</small> : null}<br /><small className="mut">becslés: a regisztráció idejéhez legközelebbi látogatás (…{mt.session})</small></> : <span className="mut">nem párosítható (pl. iPhone-app, vagy nem volt mérhető látogatás)</span>}</dd>
              <dt>Bónusz előnézet</dt><dd>{fmt(x.credits)}</dd>
              <dt>–</dt><dd>{x.gift_claimed ? "✓" : "–"}</dd>
              <dt>Üdvözlő e-mail</dt><dd>{m.welcome_sent_at ? dt(m.welcome_sent_at) : "nem ment ki"}</dd>
              <dt>Azonosító</dt><dd style={{ fontSize: 12, color: "var(--a-dim)" }}>{x.id}</dd>
            </dl>
            <h3>Mentett előnézetek ({(u.unlocks || []).length})</h3>
            {(u.unlocks || []).length ? (u.unlocks as D[]).map((un) => (
              <div key={un.name_norm + un.created_at} className="namecard"><b className="nm-cal">{String(un.name_norm).replace(/(^|\s)\S/g, (c) => c.toUpperCase())}</b><span style={{ fontSize: 12, textAlign: "right" }}>{un.calligrapher && <span className="chip gold">elkészíttette</span>} {un.has_design && <span className="chip">mintával</span>} {ago(un.created_at)}</span></div>
            )) : <Empty t="Még nincs mentett előnézete." />}
            <h3>A regisztráló látogatás</h3>
            {(u.timeline || []).length ? <ol className="tline">{(u.timeline as D[]).slice().reverse().map((y, i) => (
              <li key={i} className={y.name === "flow_step" ? "gold" : /error|failed/.test(y.name) ? "bad" : ""}>
                <time>{new Date(y.created_at).toLocaleString("hu-HU", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</time>
                <span>{EV[y.name] || y.name}{y.detail ? ` · ${QSTEP[y.detail] || SCR[y.detail] || y.detail}` : ""}{y.secs ? ` · ${dur(y.secs)}` : ""}{y.val ? `: ${String(y.val).split("+").map((w) => QVAL[w] || w).join(", ")}` : ""}</span>{y.ch && y.ch !== "közvetlen" && <small><Logo k={y.ch} size={14} />{ch(y.ch)}</small>}
              </li>))}</ol> : <Empty t="Ehhez a fiókhoz nem párosítható látogatás (iPhone-app, vagy a mérés nem látta)." />}
            {(u.days || []).length > 0 && <p className="note">Aktív napok: {(u.days as string[]).map((y) => new Date(y).toLocaleDateString("hu-HU", { month: "short", day: "numeric" })).join(" · ")}</p>}
            <p className="note">Ügyfélszolgálati nézet. Ne add ki harmadik félnek. Minden művelet (bónusz előnézet, felfüggesztés, export, törlés, e-mail) a Naplóba kerül; törölni csak a felhasználó kérésére szabad.</p>
          </>
        )}
      </aside>
    </Layer>
  );
}

/* ---------- every sign-up and the path that (most likely) brought it ---------- */
function Leads({ args, ch: c, lg }: { args: { p_days: number; p_from: string | null; p_to: string | null }; ch?: string; lg?: string }) {
  const { d, load } = useRpc("admin_leads", args, [args.p_days, args.p_from, args.p_to]);
  useEffect(() => { const iv = setInterval(() => { if (document.visibilityState === "visible") load(); }, 30_000); return () => clearInterval(iv); }, [load]);
  if (!d) return <div className="skel" style={{ height: 160 }} />;
  /* the channel and language pickers of the page filter this list too */
  /* an account that could not be matched to a visit is "ismeretlen" here too, as on the stats cards (not "közvetlen") */
  const rows = (Array.isArray(d) ? d : []).filter((r: D) => (!c || c.split(",").includes(r.matched ? r.ch || "közvetlen" : "ismeretlen")) && (!lg || String(r.lang || "").slice(0, 2) === lg));
  return <Tbl name="leadek" rows={rows} empty="Ebben az időszakban nem volt regisztráció." cols={[
    { k: "at", l: "Mikor", r: (r) => <span title={dt(r.at)}>{ago(r.at)}</span> },
    { k: "ch", l: "Csatorna", r: (r) => (r.matched ? <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><Logo k={r.ch || "közvetlen"} size={20} />{ch(r.ch || "közvetlen")}</span> : <span className="mut">nem párosítható</span>) },
    { k: "pf", l: "Platform", r: (r) => (r.pf ? PFL[r.pf] || r.pf : "–") },
    { k: "provider", l: "Mód", r: (r) => PROV[r.provider] || r.provider || "–" },
    { k: "code", l: "Rövid link", r: (r) => (r.code ? <b>inkage.app/go/{r.code}</b> : <span className="mut">–</span>) },
    { k: "post_title", l: "Poszt", r: (r) => (r.post_title ? <a href={r.post_url || undefined} target="_blank" rel="noreferrer" className="cellwrap" style={{ textDecoration: "none" }}>{PF[r.post_platform] || r.post_platform}: {String(r.post_title).slice(0, 50)}</a> : <span className="mut">–</span>) },
    { k: "lang", l: "Nyelv", r: (r) => lang(r.lang || "?") },
    { k: "secs", l: "Bent", r: (r) => (r.matched && r.secs != null ? dur(r.secs) : "–") },
    { k: "captured", l: "Bőrfotó", r: (r) => (r.captured ? "✓" : "–") },
    { k: "scored", l: "Előnézet", r: (r) => (r.scored ? "✓" : "–") },
    { k: "result_secs", l: "Eredményen", r: (r) => (r.result_secs != null ? dur(r.result_secs) : "–") },
    { k: "shots", l: "Képernyőkép", r: (r) => (n(r.shots) ? "📸 " + fmt(r.shots) : "–") },
    { k: "celeb", l: "MI-kép", num: true, r: (r) => (n(r.celeb) ? fmt(r.celeb) : "–") }, { k: "shared", l: "Megosztott", r: (r) => (r.shared ? "✓" : "–") },
    { k: "first_at", l: "Első esemény", r: (r) => (r.first_at ? ago(r.first_at) : "–") },
  ]} />;
}
