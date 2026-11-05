"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { CloseX, Sheet, pushRecent, toast, usePhone } from "../phone";
import { BarList, Donut, Empty, Info, Spark, fmt, pct, SERIES } from "../charts";
import { Card, EV, I, LANGS, P, PF, PROV, QSTEP, QVAL, SCR, SIGN, CELEB, bpDate, cleanAns, pageName, styleName, Tbl, ago, ch, dt, lang, n, periodName, periodWords, rpc, SRCK, drillTo, type D, Layer, useBlockPeriod, useFlt, useRpc } from "../shared";
import { UserRatings } from "./style-rank";
import { Logo, dur } from "../wow";
import { TRows, per } from "./traffic";
import { ActSheets, Activation, ActivationToday, CONF, ConfChip, DupeHint, Dupes, MicBtn, Payers, PeopleCards, PeopleToday, ProvIc, ScoreChip, SigGallery, SrcTag, STAGE, StageChip, StageLesson, TLine, UserMore, aiNote, authWhy, bpMidnight, chName, huErr, LoadErr, nameOf, useSigUrls, type PAct } from "./people";
import { Chg, Giant, Hero, Mono, Ring, Sig, Trio, type RingKind } from "../ink";
import { LiveNow } from "./live";
import { More } from "../extra";

const PFL: Record<string, string> = { web: "Weboldal", android: "Android-app", ismeretlen: "Nincs látogatás (iPhone-app is ide kerül)" };
const MATCH_NOTE = "Honnan jött: a regisztrációt az időben legközelebbi, azonos nyelvű névtelen látogatáshoz kötjük (a mérés fiókot nem tárol). Az iPhone-app nem küld adatot, ezért egy iPhone-os fiók kaphat idegen webes látogatást is: ilyenkor a jelölés „Nem tudjuk, honnan jött”. Az Android-app eszköz, nem forrás: ami odavitte az embert, nem ismert.";
/* the sign-ups by channel: a weak match goes under "Ismeretlen forrás", so it never reads as known */
const knownSources = (rows: D[]) => { let unk = 0; const out: { k: string; n: number }[] = []; rows.forEach((x) => { if (x.k === "ismeretlen") { unk += n(x.n); return; } const known = n(x.n) - n(x.weak); unk += n(x.weak); if (known > 0) out.push({ k: x.k, n: known }); }); if (unk) out.push({ k: "ismeretlen", n: unk }); return out.sort((a, b) => b.n - a.n); };
const confLine = (U: D, c: D) => `${fmt(U.signups)} fiókból ${fmt(c.biztos)}-ról tudjuk, honnan jött, ${fmt(c.jo)} valószínű, ${fmt(n(c.gyenge) + n(c.nincs))}-ról nem tudjuk`;

/* one share as a big ring: the share of a real total, the label says of what; a tap goes to the page behind it */
function PeStat({ l, a, b, kind, v, sub, info, to }: { l: string; a: number; b: number; kind: RingKind; v: ReactNode; sub: ReactNode; info: ReactNode; to: string }) {
  return (
    <div className="pe-stat" role="button" tabIndex={0} onClick={(e) => drillTo(to, e.currentTarget)} onKeyDown={(e) => { if (e.key === "Enter") drillTo(to, e.currentTarget); }}>
      <Ring p={b ? a / b : 0} kind={kind}><b>{v}</b></Ring>
      <span className="pe-stat-t"><em>{l}<Info>{info}</Info></em><small>{sub}</small><span className="skind own" title={SRCK.own[1]}>{SRCK.own[0]}</span></span>
    </div>
  );
}

/* the list as rows on a computer: the capital with the count, what the account is, its count on the right */
function PeopleRows({ rows, open }: { rows: D[]; open: (id: string) => void }) {
  return <ul className="pe-rows">{rows.map((x) => (
    <li key={x.id}><button className="pe-rw" onClick={() => open(x.id)}>
      <Mono name={nameOf(x)} badge={n(x.made_ok) || null} size={56} />
      <span className="pe-rw-m"><b>{(x.email || "–").replace(/@.*/, "")}<small>@{(x.email || "").split("@")[1] || ""}</small></b>
        <span className="pe-rw-c"><span className="chip pe-prov-c"><ProvIc p={x.provider} />{PROV[x.provider] || x.provider}</span>{x.score != null && <ScoreChip s={n(x.score)} />}<StageChip k={x.stage} />{x.churn && <span className="chip warn">lemorzsolódhat</span>}{x.online && <span className="chip good">● most</span>}</span>
        <small>regisztrált {ago(x.created_at)} · {x.last_active_at ? <>aktív {ago(x.last_active_at)}</> : <>belépett {ago(x.last_sign_in_at)}</>}</small></span>
      <span className="pe-rw-v"><b>{fmt(x.made_ok)}</b><small>előnézet</small></span>
    </button></li>))}</ul>;
}

/* every account the database will give at once (200), biggest makers first: the styles ranking and the percentile read it; it stays a minute */
let EVERY: { at: number; p: Promise<D> } | null = null;
function useEveryone() {
  const [d, setD] = useState<D | null>(null); const [tv, setTv] = useState(0); const sb = useMemo(() => supabaseBrowser(), []);
  useEffect(() => { let live = true; if (!EVERY || Date.now() - EVERY.at > 60e3) EVERY = { at: Date.now(), p: rpc(sb, "admin_people", { p_q: "", p_limit: 200, p_offset: 0, p_filter: "all", p_sort: "made" }).then(({ data, error }) => (error ? { failed: error.message } : (data as D) || {})) };
    EVERY.p.then((x) => { if (!live) return; /* a failed answer is not kept for a minute, and "Újra" really asks again */ if (x.failed) EVERY = null; setD(x.failed ? { ...x, retry: () => { setD(null); setTv((v) => v + 1); } } : x); }); return () => { live = false; }; }, [sb, tv]);
  return d;
}

/* who made the most signatures today, counted from their own signatures of today (Budapest day); up to 60 per account */
function TodayBest({ open }: { open: (id: string) => void }) {
  const sb = useMemo(() => supabaseBrowser(), []); const [b, setB] = useState<D | null | undefined>(undefined); const [err, setErr] = useState(""); const [tv, setTv] = useState(0);
  useEffect(() => { let live = true; setErr(""); (async () => {
    const today = bpDate(), day = (t: unknown) => (t ? bpDate(new Date(String(t))) : "");
    const { data, error } = await rpc(sb, "admin_people", { p_q: "", p_limit: 30, p_offset: 0, p_filter: "all", p_sort: "active" });
    if (error) throw new Error(error.message);
    const ppl = (((data as D)?.rows || []) as D[]).filter((x) => !x.own && day(x.last_active_at) === today && n(x.made_ok));
    if (!ppl.length) { if (live) setB(null); return; }
    const s = await rpc(sb, "admin_people_sigs", { p_ids: ppl.map((x) => x.id), p_each: 60 });
    if (s.error) throw new Error(s.error.message);
    const best = ((Array.isArray(s.data) ? s.data : []) as D[]).map((r) => { const t = ((r.sigs || []) as D[]).filter((y) => day(y.at) === today); return { who: ppl.find((x) => x.id === r.id), made: t.length, sig: t.find((y) => y.fav) || t[0] }; }).filter((x) => x.who && x.made).sort((x, y) => y.made - x.made)[0];
    if (live) setB(best || null);
  })().catch((x) => { if (live) { setB(undefined); setErr(String(x?.message || x)); } }); return () => { live = false; }; }, [sb, tv]);
  const url = useSigUrls(b?.sig ? [String(b.sig.path)] : [], false);
  if (err) return <section className="c s6 pe-best none"><span className="ink-hero-l">A mai legaktívabb</span><LoadErr e={err} retry={() => setTv((x) => x + 1)} /></section>;
  if (b === undefined) return <div className="skel s6" style={{ height: 220 }} />;
  if (!b) return <section className="c s6 pe-best none"><span className="ink-hero-l">A mai legaktívabb</span><b className="ink-h">Ma még nem készült előnézet</b></section>;
  return <button type="button" className="c s6 pe-best" onClick={() => open(b.who.id)}>
    <span className="ink-hero-l">A mai legaktívabb</span>
    <Sig u={url(String(b.sig.path))} alt="A mai előnézete" />
    <span className="pe-best-t"><b className="ink-h">{nameOf(b.who)}</b><span><b>{fmt(b.made)}</b><small>előnézet ma</small></span></span>
  </button>;
}

/* ---------- who tried the most styles, on a podium ---------- */
function StyleLeaders({ open }: { open: (id: string) => void }) {
  const e = useEveryone(); const all = ((e?.rows || []) as D[]).filter((x) => !x.own && n(x.styles) > 0);
  const top = [...all].sort((a, b) => n(b.styles) - n(a.styles) || n(b.made_ok) - n(a.made_ok)).slice(0, 3);
  const place = [top[1], top[0], top[2]], cls = ["p2", "p1", "p3"], rank = [2, 1, 3], cut = n(e?.total) > ((e?.rows || []) as D[]).length;
  return <Card className="s6" icon={P.spark} title="Ki hány stílust próbált" sub={e?.failed ? undefined : cut ? `A ${fmt(((e?.rows || []) as D[]).length)} legtöbb előnézetet készítő fiókból, a ${fmt(e?.total)}-ból.` : "Minden fiók, a saját és tesztfiókjaid nélkül."}>
    {e?.failed ? <LoadErr e={e.failed} retry={e.retry} /> : !e ? <div className="skel" style={{ height: 200 }} /> : !top.length ? <Empty t="Még senki nem próbált stílust." /> : <div className="ix-pod">{place.map((r, i) => r ? <div key={r.id} className={"ix-pd " + cls[i]}>
      <button type="button" className="ix-pd-c pe-pd" onClick={() => open(r.id)}><Mono name={nameOf(r)} size={rank[i] === 1 ? 64 : 48} /><b className="ix-st">{fmt(r.styles)}</b><small>stílus</small><span className="ix-pd-n">{nameOf(r)}</span></button>
      <span className="ix-plinth"><b>{rank[i]}</b></span>
    </div> : <div key={cls[i]} className={"ix-pd " + cls[i]}><span className="ix-plinth empty" /></div>)}</div>}
  </Card>;
}

/* what needs doing does not depend on when the account signed up: these filters and their counts look at every account, like the search */
const TODO = new Set(["followup", "banned", "stuck", "churn", "online"]);
const SORT_L: Record<string, string> = { score: "Pontszám szerint", active: "Utoljára aktív", made: "Előnézetek szerint" };
const PER_PAGE = 200;
/* every account a question matches, page by page (the database gives at most 200 at once). A failed page fails the whole answer: never half a list that looks whole */
async function everyPage(sb: ReturnType<typeof supabaseBrowser>, args: Record<string, unknown>) {
  const out: D[] = [], seen = new Set<string>(); let total = 0, off = 0, head: D = {};
  for (;;) {
    const { data, error } = await rpc(sb, "admin_people", { ...args, p_limit: PER_PAGE, p_offset: off });
    if (error) return { error: error.message, rows: out, total, head };
    head = (data as D) || {}; total = n(head.total);
    const fresh = ((head.rows || []) as D[]).filter((x) => !seen.has(x.id)); fresh.forEach((x) => { seen.add(x.id); out.push(x); });
    off += PER_PAGE;
    if (!fresh.length || off >= total) return { error: "", rows: out, total, head };
  }
}

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
  const [rows, setRows] = useState<D | null>(null); const [open, setOpen] = useState<string | null>(null); const [uv, setUv] = useState<"wall" | "days" | "cards" | "table">("wall");
  const phone = usePhone(); const [abc, setAbc] = useState(false); const [fs, setFs] = useState(false); const [pv, setPv] = useState<"wall" | "days" | "list">("wall");
  /* new accounts today: the Budapest day without your own accounts; it knows no filter, so it hides while one is on */
  const from0 = useMemo(bpMidnight, []);
  const { d: T0 } = useRpc("admin_activation", { p_days: 0, p_from: from0, p_to: null }, [from0]);
  /* a link straight to one account (/admin?u=<id>#users, e.g. from a notification) */
  useEffect(() => { try { const u = new URL(location.href), id = u.searchParams.get("u"); if (id && /^[0-9a-f-]{36}$/i.test(id)) { setOpen(id); u.searchParams.delete("u"); history.replaceState(history.state, "", u.pathname + u.search + u.hash); } } catch {} }, []);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null), seq = useRef(0), big = useRef(false);
  const [err, setErr] = useState(""); const [meta, setMeta] = useState<D | null>(null); const [metaAll, setMetaAll] = useState<D | null>(null); const [csvBusy, setCsvBusy] = useState(false);
  useEffect(() => { setPage(0); }, [lp.args.p_days, lp.args.p_from, lp.args.p_to]);
  /* a search and the to-do filters look through every account: without a period the database leaves the period out */
  const wide = !!q.trim() || TODO.has(filter);
  /* in Napok the days decide the order, so the alphabet has no say there */
  const abcOn = phone && abc && pv !== "days";
  const listArgs = () => ({ p_q: q, p_filter: filter === "today" ? "all" : filter, p_lang: fl.lang || null, p_provider: fl.prov || null, p_ch: fl.ch || null, p_sort: sort, ...(filter === "today" ? { p_days: 0, p_from: from0, p_to: null } : wide ? {} : lp.args) });
  const shape = (x: D) => ({ ...x, active_days: x.used_days, last_active: x.last_active_at, is_admin: x.own });
  useEffect(() => {
    if (t.current) clearTimeout(t.current);
    /* every account with its score and stage (admin_people); the old fields keep their names for the cards and the CSV */
    t.current = setTimeout(async () => {
      const my = ++seq.current, base = { p_q: "", p_filter: "all", p_limit: 1, p_offset: 0 };
      const samePeriod = !wide && filter !== "today";
      const [list, per0, all0] = await Promise.all([
        abcOn ? everyPage(sb, listArgs()) : rpc(sb, "admin_people", { ...listArgs(), p_limit: 25, p_offset: page * 25 }),
        samePeriod ? null : rpc(sb, "admin_people", { ...base, ...lp.args }),
        rpc(sb, "admin_people", base),
      ]);
      if (my !== seq.current) return;
      const failed = list.error ? (typeof list.error === "string" ? list.error : list.error.message) : "";
      if (failed) { setErr(failed); return; }
      setErr("");
      const r: D = abcOn ? { ...(list as D).head, total: (list as D).total, rows: (list as D).rows } : ((list as D).data as D) || {};
      big.current = abcOn && ((r.rows || []) as D[]).length > PER_PAGE;
      setRows({ ...r, rows: ((r.rows || []) as D[]).map(shape) });
      if (samePeriod) setMeta(r); else if (per0?.data) setMeta(per0.data as D);
      if (all0.data) setMetaAll(all0.data as D);
    }, 250);
  }, [sb, q, filter, page, fl, sort, ver, phone, abcOn, from0, lp.args.p_days, lp.args.p_from, lp.args.p_to]); // eslint-disable-line react-hooks/exhaustive-deps
  /* new sign-ups and what they are doing show up by themselves: the list reloads every 20 seconds while the page is in view (not a list of many pages: that is a lot to ask again and again) */
  useEffect(() => { const iv = setInterval(() => { if (document.visibilityState === "visible" && !big.current) setVer((x) => x + 1); }, 20_000); return () => clearInterval(iv); }, []);
  const MA: D = metaAll?.counts || {};
  /* the numbers on the filter buttons: the period's, except what needs doing, which is every account's */
  const C: D = { ...(meta?.counts || {}), ...(metaAll ? { followup: MA.followup, banned: MA.banned, stuck: MA.stuck, churn: MA.churn, online: MA.online } : {}) };
  const tagList: D[] = meta?.tags || [];
  const scope = filter === "today" ? "ma" : wide ? "az összes fiók" : periodWords(lp.p);
  const listState = err ? <LoadErr e={err} retry={() => { setErr(""); setVer((x) => x + 1); }} small={!!rows} /> : null;
  /* made a signature, and came back and used it again: of the accounts registered in the period */
  const mp = n(U.made_p), cfn: D = U.conf || {};
  const r1 = n(U.returned_1d_p ?? U.returned_1d), e1 = n(U.eligible_1d_p ?? U.eligible_1d), r7 = n(U.returned_7d_p ?? U.returned_7d), e7 = n(U.eligible_7d_p ?? U.eligible_7d);
  let acc = 0; const cum = ((U.cum || []) as D[]).map((x) => (acc += n(x.n)));
  const sources: D[] = U.sources || [], sourcesAll: D[] = U.sources_all || sources;
  /* the list's CSV without e-mail addresses or names (the table shows them, the file does not carry them) */
  const csv = async () => {
    if (csvBusy) return;
    setCsvBusy(true);
    const got = await everyPage(sb, listArgs());
    setCsvBusy(false);
    if (got.error) { toast("Nem sikerült a letöltés: " + huErr(got.error)); return; }
    const cols: [string, string][] = [["created_at", "Regisztrált"], ["provider", "Mód"], ["lang", "Nyelv"], ["ch", "Forrás (becslés)"], ["conf", "Mennyire tudjuk"], ["score", "Pontszám"], ["stage", "Életciklus"], ["made_ok", "Kész előnézet"], ["styles", "Stílusok"], ["saved", "Eltárolt előnézet"], ["favs", "Kedvenc"], ["used_secs", "Használat legalább (mp)"], ["used_days", "Használati napok"], ["returned", "Visszajött és használta"], ["last_active", "Utoljára aktív"], ["tags", "Címkék"]];
    const esc = (v: unknown) => { const s = v == null ? "" : String(v); return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const body = [cols.map((c) => c[1]).join(";"), ...got.rows.map(shape).map((r: D) => cols.map(([k]) => esc(k === "conf" ? CONF[r.conf]?.[0] || "" : r[k])).join(";"))].join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿" + body], { type: "text/csv;charset=utf-8" })); a.download = `fiokok-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast(got.rows.length < got.total ? `Letöltve ${fmt(got.rows.length)} fiók a ${fmt(got.total)}-ból` : `Letöltve: ${fmt(got.rows.length)} fiók`);
  };
  const filtered = !!(fl.lang || fl.prov || fl.ch), today = n((T0 as D)?.accounts), when = wide && filter !== "today" ? "az összes fiók között" : filter === "today" ? "ma" : periodWords(lp.p);
  const hero = <Hero flip label={filtered ? "Fiók összesen (szűrve)" : "Fiók összesen"} v={S ? n(U.total) : null} chg={T0 && !filtered ? <span className={"ink-chg " + (today ? "up" : "same")}>{today ? `+${fmt(today)} ma` : "ma még senki"}</span> : undefined} side={<>{S && <Trio items={[{ l: `új ${periodName(d)}`, v: fmt(U.signups) }, { l: "ebből aláírt", v: fmt(mp) }, { l: "használta 7 napban", v: fmt(U.used_7) }]} />}</>} />;
  const stMade = <PeStat to="product" l="Előnézetet készített" a={mp} b={n(U.signups)} kind="solid" v={pct(mp, n(U.signups))} sub={<>{fmt(mp)} / {fmt(U.signups)} fiók · {fmt(U.made_rows_p)} előnézet · {fmt(U.saved_rows_p)} eltárolva</>} info="Az időszakban regisztrált fiókok közül, akiknek legalább egy előnézete sikeresen elkészült. Forrás: a fiók saját előnézetei, minden eszközön." />;
  const stUsed = <PeStat to="retention" l="Használta 7 napban" a={n(U.used_7)} b={n(U.total)} kind="tick" v={fmt(U.used_7)} sub={<>a {fmt(U.total)} fiókból · ma: {fmt(U.used_1)} · 30 nap: {fmt(U.used_30)} · megnyitotta 7 napban: {fmt(U.active_7)}</>} info="Használta: előnézetet készített vagy mentett azon a napon. Megnyitotta: be volt lépve, de lehet, hogy csak a háttérben frissült a munkamenete, ezért külön szám. 10 percenként frissül." />;
  const stBack = <PeStat to="retention" l="Később is használta" a={r1} b={e1} kind="dots" v={pct(r1, e1)} sub={<>{fmt(r1)} / {fmt(e1)} fiók · 7 nap után: {pct(r7, e7)} · megnyitotta: {fmt(U.opened_1d_p)}</>} info="Az időszakban regisztrált fiókok közül, akik legalább 1 (7) nappal a regisztráció után előnézetet készítettek vagy mentettek. A megnyitotta szám tágabb: abban a háttérben frissülő munkamenet is benne lehet. A ma regisztráltak még nem számítanak." />;
  /* the same list and pickers, as a phone screen: the people first, the statistics under a button */
  if (phone) {
    const pick = (k: string) => { setFilter(filter === k ? "all" : k); setPage(0); };
    const QUICK: [string, string, unknown][] = [["today", "Mai", filtered ? null : T0 ? today : null], ["made", "Készített", C.made], ["nomade", "Nincs előnézete", C.nomade], ["returned", "Visszajött", C.returned], ["stuck", "Elakadt", C.stuck], ["aktiv", STAGE.aktiv[0], C.aktiv], ["online", "Most aktív", C.online], ["followup", "Visszakeresés", C.followup], ...(n(C.paid) ? [["paid", "Fizetők", C.paid] as [string, string, unknown]] : [])];
    const voice = (t: string) => { setQ(t.toLowerCase().replace(/\s*kukac\s*/g, "@").replace(/\s*pont\s*/g, ".").replace(/[.!?]$/, "")); setPage(0); };
    const activeFl = [fl.lang && lang(fl.lang), fl.prov && PROV[fl.prov], fl.ch && (fl.ch === "ismeretlen" ? "Nem párosítható" : ch(fl.ch))].filter(Boolean).join(" · ");
    return (
      <div className="g pp">
        {hero}
        <ActivationToday />
        <TodayBest open={setOpen} />
        <section className="s12 pp-list">
          <div className="pp-q"><input className="adm-in" type="search" inputMode="search" placeholder="Név, e-mail, azonosító" aria-label="Keresés" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} /><MicBtn label="Keresés hanggal" onText={voice} /></div>
          <div className="pp-chips hscroll">{QUICK.map(([k, l, c]) => <button key={k} aria-pressed={filter === k} onClick={() => pick(k)}>{l}{c != null ? <i>{fmt(n(c))}</i> : null}</button>)}<button className="pp-more" onClick={() => setFs(true)}>Több szűrő{activeFl || lp.own || sort !== "created" || (!QUICK.some((x) => x[0] === filter) && filter !== "all") ? " •" : ""}</button></div>
          <div className="pp-top pe-top"><span>{rows ? `${fmt(rows.total)} fiók` : "…"} · {scope}{!abcOn && SORT_L[sort] ? ` · ${SORT_L[sort]}` : ""}{activeFl ? ` · ${activeFl}` : ""}</span><div className="adm-seg sm"><button aria-pressed={pv === "wall"} onClick={() => setPv("wall")}>Képek</button><button aria-pressed={pv === "days"} onClick={() => setPv("days")}>Napok</button><button aria-pressed={pv === "list"} onClick={() => setPv("list")}>Lista</button></div>{pv !== "days" && <div className="adm-seg sm"><button aria-pressed={!abc && sort === "created"} onClick={() => { setAbc(false); setSort("created"); setPage(0); }}>Újak elöl</button><button aria-pressed={abc} onClick={() => { setAbc(true); setSort("created"); setPage(0); }}>ABC</button></div>}</div>
          {listState}
          {!rows ? (err ? null : <div className="skel" style={{ height: 240 }} />) : (rows.rows || []).length ? <PeopleCards wall={pv === "wall"} days={pv === "days"} rows={rows.rows} open={setOpen} abc={abcOn} reload={() => setVer((x) => x + 1)} /> : <Empty t={`Nincs találat ${when}.`} />}
          {rows && abcOn && (rows.rows || []).length < n(rows.total) && <p className="note">A lista nem teljes: {fmt((rows.rows || []).length)} fiók látszik a {fmt(rows.total)}-ból.</p>}
          {rows && pv === "list" && (rows.rows || []).length > 0 && <small className="pp-tip">Húzd a sort balra: jegyzet, tovább: írás. Jobbra: visszakeresés.</small>}
          {rows && !abcOn && n(rows.total) > 25 && <div className="pager"><span>{page * 25 + 1}–{Math.min(n(rows.total), (page + 1) * 25)} / {fmt(rows.total)}</span><div className="adm-row"><button className="adm-ibtn" disabled={!page} onClick={() => setPage(page - 1)}>← Előző</button><button className="adm-ibtn" disabled={(page + 1) * 25 >= n(rows.total)} onClick={() => setPage(page + 1)}>Következő →</button></div></div>}
        </section>
        <LiveNow online={n(C.online)} />
        <PeopleToday open={setOpen} />
        <Payers open={setOpen} />
        <Dupes open={setOpen} />
        <More label="Statisztika: módok, nyelvek, források, leadek">
          <div className="s12 pe-stats">{stMade}{stBack}</div>
          <StyleLeaders open={setOpen} />
          <Card className="s12" icon={P.target} title="Honnan regisztráltak" sub={MATCH_NOTE}><BarList items={knownSources(sources)} fmtK={(k) => (k === "ismeretlen" ? "Ismeretlen forrás" : ch(k))} /><span className="note">{confLine(U, cfn)}</span></Card>
          <Card className="s12" icon={P.user} title="Regisztráció módja"><BarList items={(U.providers || []).map((x: D) => ({ k: x.k, n: n(x.n) }))} fmtK={(k) => PROV[k] || k} /></Card>
          <Card className="s12" icon={P.globe} title="Fiókok nyelve"><BarList items={(U.langs || []).map((x: D) => ({ k: x.k, n: n(x.n) }))} fmtK={lang} max={7} /></Card>
          <Activation />
          <div className="s12"><StageLesson /></div>
          <Card right={ld.ctl} className="s12" icon={P.target} title="Leadek: honnan jött minden regisztráció" sub={MATCH_NOTE}><Leads args={ld.args} ch={fl.ch} lg={fl.lang} /></Card>
        </More>
        {fs && <Sheet title="Szűrők" close={() => setFs(false)} foot={<button className="adm-ibtn gold" onClick={() => setFs(false)}>Kész</button>}>
          <h4 className="ps-t">Állapot</h4>
          <div className="ps-opts">{([["all", "Mind", null], ["churn", "Lemorzsolódhat", C.churn], ["stuck", "Elakadt", C.stuck], ["uj", STAGE.uj[0], C.uj], ["probalgatja", STAGE.probalgatja[0], C.probalgatja], ["veszelyben", STAGE.veszelyben[0], C.veszelyben], ["alvo", STAGE.alvo[0], C.alvo], ["banned", "Felfüggesztve", C.banned], ["own", "Saját és teszt", meta?.own]] as [string, string, unknown][]).map(([k, l, c]) => <button key={k} aria-pressed={filter === k} onClick={() => { setFilter(k); setPage(0); }}>{l}{n(c) ? ` · ${fmt(n(c))}` : ""}</button>)}{tagList.map((t: D) => <button key={t.k} aria-pressed={filter === "tag:" + t.k} onClick={() => { setFilter("tag:" + t.k); setPage(0); }}>#{t.k} · {fmt(t.n)}</button>)}</div>
          <h4 className="ps-t">Regisztrált</h4>{lp.ctl}
          <div className="pfield"><span>Nyelv</span><select className="adm-in" value={fl.lang} onChange={(e) => { setFl({ ...fl, lang: e.target.value }); setPage(0); }}><option value="">Minden nyelv</option>{Object.keys(LANGS).filter((k) => k !== "?" && k !== "nb").map((k) => <option key={k} value={k}>{LANGS[k]}</option>)}</select></div>
          <div className="pfield"><span>Belépés</span><select className="adm-in" value={fl.prov} onChange={(e) => { setFl({ ...fl, prov: e.target.value }); setPage(0); }}><option value="">Minden belépési mód</option>{Object.entries(PROV).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
          <div className="pfield"><span>Forrás</span><select className="adm-in" value={fl.ch} onChange={(e) => { setFl({ ...fl, ch: e.target.value }); setPage(0); }}><option value="">Minden forrás</option>{sourcesAll.map((x) => <option key={x.k} value={x.k}>{x.k === "ismeretlen" ? "Nem párosítható" : ch(x.k)}</option>)}</select></div>
          <div className="pfield"><span>Sorrend</span><select className="adm-in" value={abc ? "abc" : sort} onChange={(e) => { const v = e.target.value; setAbc(v === "abc"); setSort(v === "abc" ? "created" : v); setPage(0); }}><option value="created">Legújabb elöl</option><option value="score">Pontszám szerint</option><option value="active">Utoljára aktív</option><option value="made">Előnézetek szerint</option><option value="abc">ABC</option></select></div>
          <button className="lnk ps-csv" disabled={csvBusy} onClick={csv}>{csvBusy ? "Készül a táblázat…" : "A lista letöltése táblázatként ⤓"}</button>
        </Sheet>}
        {open && <UserDrawer id={open} close={() => setOpen(null)} changed={() => setVer((x) => x + 1)} openOther={setOpen} />}
      </div>
    );
  }
  return (
    <div className="g">
      <div className="s12 pe-head">
        {hero}
        <section className="pe-per">
          <span className="ink-hero-l">Új fiókok {periodName(d)}<Info>Az időszakban regisztráltak közül <b>{pct(mp, n(U.signups))}</b> készített előnézetet ({fmt(U.made_rows_p)} darab), és <b>{pct(r1, e1)}</b> egy későbbi napon is használta. Ezek a fiókok saját adataiból jönnek, minden eszközön, az iPhone-appban is. A saját és tesztfiókjaid egyik számban sincsenek benne (a listában a „Saját és teszt” gomb mutatja őket); a nyelv-, belépés- és forrásszűrő a fenti számokra is hat. A „ma” budapesti nap.</Info></span>
          <Giant v={S ? n(U.signups) : null} max={120} />
          {S && <span className="ink-hero-s"><Chg a={n(U.signups)} b={n(U.signups_prev)} tail="az előző időszakhoz" /></span>}
          <Spark values={cum} h={64} />
        </section>
        <ActivationToday />
      </div>
      <div className="s12 pe-stats">{stMade}{stUsed}{stBack}</div>
      <TodayBest open={setOpen} />
      <StyleLeaders open={setOpen} />

      <Card className="s3" icon={P.user} title="Regisztráció módja" sub={`Az időszakban regisztráltak (${fmt(U.signups)} fiók).`}><Donut items={(U.providers || []).map((x: D) => ({ k: x.k, n: n(x.n) }))} center={fmt(U.signups)} sub="új fiók" label={(k) => PROV[k] || k} color={(k) => ({ email: SERIES[0], google: SERIES[2], apple: SERIES[1] } as D)[k] || SERIES[3]} size={140} /></Card>
      <Card className="s3" icon={P.globe} title="Fiókok nyelve" sub="Az időszakban regisztráltak, a fiókhoz mentett nyelv szerint."><BarList items={(U.langs || []).map((x: D) => ({ k: x.k, n: n(x.n) }))} fmtK={lang} max={7} /></Card>
      <Card className="s3" icon={P.target} title="Honnan regisztráltak" sub={MATCH_NOTE}><BarList items={knownSources(sources)} fmtK={(k) => (k === "ismeretlen" ? "Ismeretlen forrás" : ch(k))} /><span className="note">{confLine(U, cfn)}</span></Card>
      <Card className="s3" icon={P.eye} title="Honnan: eszköz" sub="A regisztráló látogatás alapján (becslés). iPhone-sor nincs, mert az iPhone-app nem küld adatot: ezek a fiókok az ismeretlenek között vannak."><BarList items={(U.platforms || []).map((x: D) => ({ k: x.k, n: n(x.n) }))} fmtK={(k) => PFL[k] || k} /></Card>

      <Card className="s12" icon={P.users} title="Felhasználók" sub={`Fiókok, ${periodWords(lp.p)} regisztráltak (a blokk időszaka alapból ugyanaz, mint fölül; „Összes”: minden fiók). A keresés (e-mail, név, azonosító) és a Visszakeresés, Lemorzsolódhat, Elakadt, Most aktív és Felfüggesztve szűrő az időszaktól függetlenül minden fiókot néz, a számaik is; a többi gomb számai az időszak fiókjai. Szűrés nyelvre, belépési módra és forrásra. Kattints egy sorra a részletekért. A CSV minden találatot tartalmaz, e-mail-cím és név nélkül.`} right={<>{lp.ctl}{rows && <span className="chip gold">{fmt(rows.total)} találat · {scope}</span>}<button className="lnk" disabled={csvBusy} onClick={csv}>{csvBusy ? "Készül…" : "CSV ⤓"}</button></>}>
        <div className="adm-row">
          <input className="adm-in" style={{ flex: "1 1 260px" }} placeholder="Keresés: e-mail, név, azonosító…" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
          <select className="adm-in sm" value={sort} onChange={(e) => { setSort(e.target.value); setPage(0); }} aria-label="Sorrend"><option value="created">Legújabb elöl</option><option value="score">Pontszám szerint</option><option value="active">Utoljára aktív</option><option value="made">Előnézetek szerint</option></select>
        </div>
        {/* the stages and the to-do filters, each with its count (the numbers leave out your own accounts) */}
        <div className="adm-seg sm" style={{ flexWrap: "wrap" }}>
          {([["all", "Mind", null], ["today", "Mai", filtered ? null : T0 ? today : null], ["followup", "Visszakeresés", C.followup], ["churn", "Lemorzsolódhat", C.churn], ["stuck", "Elakadt", C.stuck], ["uj", STAGE.uj[0], C.uj], ["probalgatja", STAGE.probalgatja[0], C.probalgatja], ["aktiv", STAGE.aktiv[0], C.aktiv],
            ["veszelyben", STAGE.veszelyben[0], C.veszelyben], ["alvo", STAGE.alvo[0], C.alvo], ["online", "Most aktív", C.online], ["made", "Készített előnézetet", C.made], ["returned", "Később is használta", C.returned], ["banned", "Felfüggesztve", C.banned],
            ["own", "Saját és teszt", meta?.own]] as [string, string, unknown][]).map(([k, l, c]) => (
            <button key={k} aria-pressed={filter === k} onClick={() => { setFilter(k); setPage(0); }}>{l}{c != null && n(c) > 0 ? ` · ${fmt(n(c))}` : ""}</button>
          ))}
        </div>
        {tagList.length > 0 && <div className="adm-row" style={{ gap: 6, flexWrap: "wrap" }}>{tagList.map((t) => <button key={t.k} className={"chip" + (filter === "tag:" + t.k ? " gold" : "")} onClick={() => { setFilter(filter === "tag:" + t.k ? "all" : "tag:" + t.k); setPage(0); }}>#{t.k} · {fmt(t.n)}</button>)}</div>}
        <div className="adm-row">
          <select className="adm-in sm" value={fl.lang} onChange={(e) => { setFl({ ...fl, lang: e.target.value }); setPage(0); }}><option value="">Minden nyelv</option>{Object.keys(LANGS).filter((k) => k !== "?" && k !== "nb").map((k) => <option key={k} value={k}>{LANGS[k]}</option>)}</select>
          <select className="adm-in sm" value={fl.prov} onChange={(e) => { setFl({ ...fl, prov: e.target.value }); setPage(0); }}><option value="">Minden belépési mód</option>{Object.entries(PROV).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          <select className="adm-in sm" value={fl.ch} onChange={(e) => { setFl({ ...fl, ch: e.target.value }); setPage(0); }}><option value="">Minden forrás</option>{sourcesAll.map((x) => <option key={x.k} value={x.k}>{x.k === "ismeretlen" ? "Nem párosítható" : ch(x.k)}</option>)}</select>
          <div className="adm-seg sm"><button aria-pressed={uv === "wall"} onClick={() => setUv("wall")}>Képek</button><button aria-pressed={uv === "days"} onClick={() => setUv("days")}>Napok</button><button aria-pressed={uv === "cards"} onClick={() => setUv("cards")}>Sorok</button><button aria-pressed={uv === "table"} onClick={() => setUv("table")}>Táblázat</button></div>
        </div>
        {listState}
        {!rows ? (err ? null : <div className="skel" style={{ height: 200 }} />) : uv !== "table" ? (
          !(rows.rows || []).length ? <Empty t={`Nincs találat ${when}.`} /> : uv === "wall" || uv === "days" ? <PeopleCards wall days={uv === "days"} rows={rows.rows} open={setOpen} reload={() => setVer((x) => x + 1)} /> : <PeopleRows rows={rows.rows} open={setOpen} />
        ) : (
          <Tbl rows={rows.rows || []} onRow={(x) => setOpen(x.id)} csv={false} empty={`Nincs találat ${when}.`} cols={[
            { k: "email", l: "Fiók", r: (x) => <div style={{ display: "flex", gap: 10, alignItems: "center" }}><Mono name={x.email} size={34} /><div><b>{x.email || "–"}</b>{x.is_admin && <span className="chip gold" style={{ marginLeft: 8 }}>admin</span>}<div className="mut" style={{ fontSize: 12 }}>{x.name || "névtelen"}</div></div></div> },
            { k: "score", l: "Pont", num: true, r: (x) => <ScoreChip s={n(x.score)} /> },
            { k: "stage", l: "Életciklus", r: (x) => <span style={{ display: "inline-flex", gap: 4, flexWrap: "wrap" }}><StageChip k={x.stage} />{x.churn && <span className="chip warn">lemorzsolódhat</span>}{x.online && <span className="chip good">● most</span>}{x.banned && <span className="chip bad">felfüggesztve</span>}{(x.tags || []).map((t: string) => <span key={t} className="chip">#{t}</span>)}</span> },
            { k: "provider", l: "Belépés, nyelv", r: (x) => <>{PROV[x.provider] || x.provider}<div className="mut" style={{ fontSize: 12 }}>{lang(x.lang || "?")}</div></> },
            { k: "ch", l: "Forrás", r: (x) => <SrcTag c={x.ch} conf={x.conf} site={x.ai_site} short /> },
            { k: "made_ok", l: "Előnézet", num: true, r: (x) => <>{fmt(x.made_ok)}{x.last_made_at && <div className="mut" style={{ fontSize: 12 }}>{ago(x.last_made_at)}</div>}</> },
            { k: "styles", l: "Stílus, kedvenc", num: true, r: (x) => <>{fmt(x.styles)}<div className="mut" style={{ fontSize: 12 }}>{fmt(x.favs)} kedvenc</div></> },
            { k: "used_secs", l: "Használat", num: true, r: (x) => <>{n(x.made_ok) || n(x.saved) ? dur(x.used_secs) : "–"}<div className="mut" style={{ fontSize: 12 }}>{fmt(x.active_days)} napon</div></> },
            { k: "last_active", l: "Aktív, regisztrált", r: (x) => <>{x.last_active ? ago(x.last_active) : "–"}<div className="mut" style={{ fontSize: 12 }} title={dt(x.created_at)}>reg. {ago(x.created_at)}</div></> },
          ]} />
        )}
        {rows && uv === "table" && (rows.rows || []).length > 0 && <p className="pe-tbl-hint">Keskenyebb ablakban a táblázat oldalra görgethető.</p>}
        {rows && n(rows.total) > 25 && (
          <div className="pager"><span>{page * 25 + 1}–{Math.min(n(rows.total), (page + 1) * 25)} / {fmt(rows.total)}</span>
            <div className="adm-row"><button className="adm-ibtn" disabled={!page} onClick={() => setPage(page - 1)}>← Előző</button><button className="adm-ibtn" disabled={(page + 1) * 25 >= n(rows.total)} onClick={() => setPage(page + 1)}>Következő →</button></div></div>
        )}
      </Card>
      <div className="s12"><StageLesson /></div>
      <PeopleToday open={setOpen} />
      <Activation />
      <Card right={ld.ctl} className="s12" icon={P.target} title="Leadek: honnan jött minden regisztráció" sub={`Minden regisztráció ${periodWords(ld.p)}: honnan jött (és mennyire tudjuk), a link vagy poszt, ami hozta, hány előnézete készült, és mit csinált a látogatásában. Ha nem tudjuk, honnan jött, a látogatás adatai nem látszanak. E-mail nélkül; CSV-be menthető. ${MATCH_NOTE}`}>
        <Leads args={ld.args} ch={fl.ch} lg={fl.lang} />
      </Card>
      {open && <UserDrawer id={open} close={() => setOpen(null)} changed={() => setVer((x) => x + 1)} openOther={setOpen} />}
    </div>
  );
}

/* ---------- the user's page: what the sign-up visit did, in plain sentences ----------
   One row per thing to know (✓ done, ○ not), the pages and screens looked at in order with their time, the quiz answers;
   first what the account itself made, which holds on any device. All from admin_user (visit, celeb, timeline). */
function Row({ ok, warn, children, sub }: { ok?: boolean; warn?: boolean; children: ReactNode; sub?: ReactNode }) {
  return (
    <li className="pe-j">
      <span aria-hidden="true" className={warn ? "w" : ok ? "o" : ""}>{warn ? "!" : ok ? "✓" : "–"}</span>
      <span>{children}{sub ? <small>{sub}</small> : null}</span>
    </li>
  );
}

/* the app's steps (flow_step) as the person saw them: the intro questions are one screen, "analysis" fires with the reveal */
const QUIZ = new Set(["use", "imp", "spd", "hand", "pain", "share", "prof", "gender", "style", "leg", "occasion", "age", "feel", "len"]);
export const stepName = (k: unknown) => { const s = String(k || ""); return QUIZ.has(s) ? "Bevezető kérdések" : ({ name: "Kezdés", sign: "Bőrfotó", scan: "Előnézet készül", score: "Előnézet", reveal: "Eredmény: 50 év múlva", swipe: "Eredmény: kedvencek", picks: "Eredmény: kedvencek", detail: "Eredmény: mentés" } as Record<string, string>)[s] || QSTEP[s] || s; };

const hm = (t: string) => new Date(t).toLocaleTimeString("hu-HU", { hour: "2-digit", minute: "2-digit" });

/* the sign-up page in that visit: how long, how many tries, what went wrong (auth_step events, sent by the sign-up screen) */
const AUTH_L: Record<string, string> = { inapp: "beépített böngészőből nyitotta (TikTok, Instagram…)", iab_open: "megpróbálta a rendes böngészőben megnyitni", iab_copy: "kimásolta a linket a beépített böngészőből", sent: "megkapta a megerősítő levelet", use_link: "belépőlinket kért jelszó helyett", use_password: "visszaváltott jelszóra" };
const isRegEv = (y: D) => (y.name === "auth_step" ? y.auth?.mode !== "login" : y.name === "landing_view" && /^(\/[a-z-]{2,5})?\/register/.test(String(y.path || "")));
function regFacts(tl: D[]) {
  const reg = tl.filter(isRegEv); if (!reg.length) return null;
  const steps = tl.filter((y) => y.name === "auth_step" && y.auth);
  const tries = steps.filter((y) => ["tap_google", "tap_apple", "submit"].includes(y.auth.s)).length;
  const errs = new Map<string, number>(); steps.filter((y) => y.auth.s === "error").forEach((y) => { const w = authWhy(y.auth.why); errs.set(w, (errs.get(w) || 0) + 1); });
  const notes = Array.from(new Set(steps.map((y) => AUTH_L[y.auth.s]).filter(Boolean)));
  return { secs: (Date.parse(reg[reg.length - 1].created_at) - Date.parse(reg[0].created_at)) / 1000, tries, errs: Array.from(errs, ([w, c]) => (c > 1 ? `${w} (${c}×)` : w)), notes };
}
const acc = (s: number) => inTime(s).replace(/másodperc$/, "másodpercet").replace(/perc$/, "percet").replace(/óra$/, "órát").replace(/nap$/, "napot");
/* where the time went, by screen: "kérdések 5 p 49 mp, eredmény 51 mp" */
const SCR_ORDER = ["name", "welcome", "scan", "old", "quiz", "ana", "res", "home", "insp", "fav"];
function timeSplit(v: D | null) {
  const sc: D = v?.screens || {}, sum: Record<string, number> = {};
  Object.entries(sc).forEach(([k, x]) => { const g = ["rev", "picks", "det", "swipe"].includes(k) ? "res" : k; sum[g] = (sum[g] || 0) + n(x); });
  const name = (k: string) => (k === "res" ? "eredmény" : String(SCR[k] || k).toLowerCase());
  return Object.keys(sum).filter((k) => sum[k] >= 1).sort((a, b) => (SCR_ORDER.indexOf(a) + 100) % 100 - (SCR_ORDER.indexOf(b) + 100) % 100).map((k) => `${name(k)} ${dur(sum[k])}`).join(", ");
}
/* the same look on the same name again: "Old money ×3" */
function regens(c: D) { const m = new Map<string, { style: string; n: number }>(); ((c.list || []) as D[]).filter((x) => x.ok).forEach((x) => { const k = x.style + "|" + x.name_norm; const o = m.get(k); if (o) o.n++; else m.set(k, { style: x.style, n: 1 }); }); return Array.from(m.values()).filter((x) => x.n > 1).sort((a, b) => b.n - a.n); }
/* came back and made or saved something on a later day */
const bpDay = (t: string) => new Date(t).toLocaleDateString("sv-SE", { timeZone: "Europe/Budapest" });
function cameBack(u: D) {
  const c0 = u.user?.created_at; if (!c0) return "";
  const d0 = bpDay(c0), days = [...((u.celeb?.list || []) as D[]).filter((x) => x.ok).map((x) => bpDay(x.created_at)), ...((u.days_used || []) as string[]).map((x) => String(x).slice(0, 10))].filter((x) => x > d0).sort();
  if (!days.length) return "";
  const k = Math.round((Date.parse(days[0]) - Date.parse(d0)) / 864e5);
  return k === 1 ? "Másnap visszajött" : `${fmt(k)} nap múlva visszajött`;
}
/* how long until the first signature: from the visit's first moment when the visit is his, otherwise from the sign-up */
function firstSig(u: D, sure: boolean) {
  const c: D = u.celeb || {}, v: D | null = u.visit || null; if (!c.first_at) return "";
  const t = Date.parse(c.first_at), fromV = sure && v?.first_at ? (t - Date.parse(v.first_at)) / 1000 : -1, fromU = u.user?.created_at ? (t - Date.parse(u.user.created_at)) / 1000 : -1;
  if (fromV > 0 && fromV < 6 * 3600) return `az oldalra érkezése után ${inTime(fromV)} múlva kész volt az első előnézete`;
  return fromU > 0 ? `a regisztráció után ${inTime(fromU)} múlva kész volt az első előnézete` : "";
}

function Journey({ u }: { u: D }) {
  const v: D | null = u.visit || null, cu: D = u.celeb || {}, tl: D[] = u.timeline || [], mt: D = u.match || {};
  const reg = regFacts(tl), split = timeSplit(v), fs0 = firstSig(u, !!u.match && u.match.conf !== "gyenge");
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
  const weak = mt.conf === "gyenge", saved: D[] = u.saved || [], favs = saved.filter((x) => x.fav).length;
  const made = (
    <>
      <h3>Mit készített</h3>
      <ul className="pe-js">
        <Row ok={n(cu.ok) > 0} sub={cu.first_at ? `első: ${dt(cu.first_at)} · utolsó: ${dt(cu.last_at)} · az elmúlt 24 órában: ${fmt(cu.used24)}` : "A fiók saját adatai, minden eszközön, az iPhone-appban is."}>
          {n(cu.total) ? <>Elkészült <b>{fmt(cu.ok)} előnézete</b>{(cu.looks || []).length ? <> ({(cu.looks as D[]).map((x) => `${CELEB[x.k] || x.k} ×${x.n}`).join(", ")})</> : null}{n(cu.ok) < n(cu.total) ? `, további ${fmt(n(cu.total) - n(cu.ok))} nem sikerült` : ""}</> : "Nem készített előnézetet"}
        </Row>
        <Row ok={saved.length > 0}>{saved.length ? <>{fmt(saved.length)} előnézet van a fiókjában{favs ? <>, ebből <b>{fmt(favs)} kedvenc</b></> : ", kedvence nincs"}</> : "Nincs előnézet a fiókjában"}</Row>
        {u.user?.id && <UserRatings id={u.user.id} />}
        {regens(cu).length > 0 && <Row warn sub="Ugyanabban a stílusban készült újra.">Újragenerálta ugyanazt a stílust: {regens(cu).map((r) => `${CELEB[r.style] || styleName(r.style)} ×${r.n}`).join(", ")}</Row>}
        {cameBack(u) && <Row ok sub="Egy későbbi napon készített vagy mentett előnézetet.">{cameBack(u)}</Row>}
        {(u.days_used || []).length > 0 && <Row ok={(u.days_used as string[]).length > 1} sub={(u.days_used as string[]).map((y) => new Date(y).toLocaleDateString("hu-HU", { month: "short", day: "numeric" })).join(" · ")}>{(u.days_used as string[]).length > 1 ? <><b>{fmt((u.days_used as string[]).length)} különböző napon</b> használta</> : "Egy napon használta"}</Row>}
      </ul>
    </>
  );
  if (!v) return <>{made}<h3>A látogatása</h3><Empty t="Nincs hozzá látogatás: az iPhone-app nem küld adatot, vagy a mérés nem látta. Amit készített, az fent látszik." /></>;
  return (
    <>
      {made}
      <h3>A regisztráló látogatás <ConfChip k={mt.conf} />{v.live && !weak && <span className="chip good" style={{ marginLeft: 8 }}>● most is bent van</span>}</h3>
      {weak && <div className="alert err" role="note">Ez valószínűleg nem az ő látogatása ({mt.near_secs != null ? `${dur(mt.near_secs)} távolságra volt a regisztrációtól` : "időben messze van"}{n(mt.shared_with) ? `, és ${fmt(mt.shared_with)} másik fiókhoz is ez a legközelebbi` : ""}). Az alábbiakat ne vedd róla szóló ténynek; amit készített, az fent pontos.</div>}
      <ul className="pe-js">
        <Row ok sub={`${hm(v.first_at)} – ${hm(v.last_at)} · ${dt(v.first_at)}${n(v.span_secs) > n(v.secs) + 300 ? ` · a két vége között ${dur(v.span_secs)} telt el, a hosszú szüneteket nem számoljuk` : ""}`}>{v.opened ? <><b>{dur(v.secs)}</b> volt aktívan bent</> : <><b>{dur(v.secs)}</b> volt az oldalon, az appot nem nyitotta meg</>}</Row>
        {reg && <Row warn={reg.errs.length > 0} ok={!reg.errs.length && reg.tries > 0} sub={[...reg.errs, ...reg.notes].join(" · ") || undefined}>Regisztrációs oldal: {reg.secs >= 10 ? <><b>{dur(reg.secs)}</b>, </> : null}{reg.tries ? <><b>{fmt(reg.tries)}</b> próbálkozás</> : "a próbálkozásokat nem mértük"}</Row>}
        {split && <Row ok sub={fs0 || undefined}>Hol töltötte az időt: {split}</Row>}
        {!split && fs0 && <Row ok>{fs0[0].toUpperCase() + fs0.slice(1)}</Row>}
        <Row ok={v.captured} warn={v.skipped} sub={v.captured ? SIGN[v.sign] || undefined : undefined}>{v.captured ? (v.sign === "photo" ? "Feltöltött egy bőrfotót (fotóról kivágott mintával)" : "Feltöltött egy bőrfotót") : v.skipped ? "Kihagyta a bőrfotót" : v.opened ? "Nem jutott el a bőrfotóig" : "Az appban nem járt, ezért nem töltött fel bőrfotót"}</Row>
        <Row ok={v.scored}>{v.scored ? "Megkapta az előnézetet" : "Nem kapta meg az előnézetet"}</Row>
        <Row ok={!!v.style} sub={v.quiz ? "a bevezető kérdéseknél" : undefined}>Választott stílus: <b>{styleName(v.style)}</b></Row>
        <Row ok={v.celebrated}>{v.celebrated ? "Elfogadta az előnézetét (záró képernyő)" : "Nem jutott a záró képernyőig"}</Row>
        <Row ok={v.revealed} sub={v.timed ? `Az eredményen töltött idő: ${dur(v.result_secs)}` : v.revealed ? "Az eredményen töltött időt akkor még nem mértük" : undefined}>{v.revealed ? "Megnézte 50 év múlva" : "Nem nézte meg 50 év múlva"}</Row>
        <Row ok={n(v.detail) > 0}>{n(v.detail) ? `${fmt(v.detail)} előnézetet mentett el` : "Nem mentett el előnézetet"}</Row>
        <Row ok={n(v.saved) > 0}>{n(v.saved) ? `${fmt(v.saved)} alkalommal mentett képet` : "Nem mentett képet"}{v.mailed ? " · e-mailben is megkapta" : ""}</Row>
        <Row ok={v.shared}>{v.shared ? "Megosztotta" : "Nem osztotta meg"}</Row>
        {n(v.shots) > 0 && <Row warn sub={v.shot_scr ? `ezen a képernyőn: ${SCR[v.shot_scr] || v.shot_scr}` : undefined}>{fmt(v.shots)} képernyőkép-gombot nyomott (számítógépen)</Row>}
        {n(v.errors) > 0 && <Row warn>{fmt(v.errors)} hiba történt nála</Row>}
        <Row sub={ago(v.last_at)}>Ebben a látogatásban itt hagyta abba: <b>{v.last_scr ? SCR[v.last_scr] || v.last_scr : v.last_step ? stepName(v.last_step) : "–"}</b>{v.left_how === "hidden" ? " · bezárta vagy elhagyta az oldalt" : ""}</Row>
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
      {!timed && pages.length > 0 && <p className="note">Ennél a látogatásnál az oldalakon töltött idő nem mért, csak a sorrend látszik.</p>}

      {answers.length > 0 && <>
        <h3>Válaszai a bevezető kérdésekre</h3>
        <dl className="kv">
          {answers.map((y, i) => <Fragment key={i}><dt>{QSTEP[y.detail] || y.detail}</dt><dd>{String(y.val ?? "").split("+").map((w) => QVAL[w] || cleanAns(w)).join(", ")}</dd></Fragment>)}
        </dl>
      </>}
    </>
  );
}

/* ---------- the account as a story: only what its data says; what comes from the estimated visit only when that is not a weak match ---------- */
const FROM: Record<string, string> = { instagram: "Instagramról", tiktok: "TikTokról", google: "Google-keresésből", pinterest: "Pinterestről", facebook: "Facebookról", youtube: "YouTube-ról", linkedin: "LinkedInről", reddit: "Redditről", ai: "MI-keresőből", email: "E-mailből", bing: "Bingről" };
const inTime = (s: number) => (s < 90 ? `${Math.max(1, Math.round(s))} másodperc` : s < 5400 ? `${Math.round(s / 60)} perc` : s < 172800 ? `${Math.round(s / 3600)} óra` : `${Math.round(s / 86400)} nap`);
const cap = (t: string) => (t ? t[0].toUpperCase() + t.slice(1) : t);
function AccountStory({ u }: { u: D }) {
  const x: D = u.user || {}, mt: D | null = u.match || null, v: D | null = u.visit || null, c: D = u.celeb || {}, saved: D[] = u.saved || [], tl: D[] = u.timeline || [];
  const sure = !!mt && mt.conf !== "gyenge", guess = mt?.conf === "jo" ? "valószínűleg " : "", say: string[] = [], made = n(c.ok);
  const [why, setWhy] = useState(false);
  if (!mt) say.push("Nem tudjuk, honnan jött: nincs hozzá mért látogatás (iPhone-app, vagy a mérés nem látta).");
  else if (!sure) say.push("Nem tudjuk, honnan jött.");
  else if (mt.ch === "androidapp") say.push(`Az Android-appból nyitotta meg, azt nem látjuk, mi vitte oda.`);
  else if (mt.ch === "közvetlen") say.push(`${guess ? "Valószínűleg k" : "K"}özvetlenül jött, forrás nélkül.`);
  else if (mt.ch === "ai" && mt.ai_site) say.push(`${guess ? "Valószínűleg a" : "A"} ${mt.ai_site} felől jött.`);
  else say.push(`${guess ? "Valószínűleg " : ""}${FROM[mt.ch] || ch(mt.ch) + " felől"} jött.`);
  /* a visit that never reached the app: the sign-up page is what happened */
  const reg = sure ? regFacts(tl) : null, conf = x.provider === "email" && !x.email_confirmed_at;
  if (sure && v && !v.opened) {
    const parts: string[] = [];
    if (reg && reg.secs >= 10) parts.push(`${guess}${acc(reg.secs)} töltött a regisztrációs oldalon`);
    else if (n(v.secs) > 0) parts.push(`${guess}${dur(v.secs)} volt az oldalon`);
    parts.push(reg && reg.tries > 1 ? `${fmt(reg.tries)} próbálkozás után regisztrált` : "regisztrált");
    parts.push("az appot nem nyitotta meg");
    parts.push(made ? `a fiókjához ${fmt(made)} előnézet készült egy másik látogatásban` : "előnézet nem készült");
    say.push(cap(parts.join(", ")) + ".");
    if (reg?.errs.length) say.push(cap(`közben: ${reg.errs.join(", ")}.`));
    if (reg?.notes.length) say.push(cap(reg.notes.join(", ")) + ".");
    if (conf) say.push("Az e-mail-címét még nem erősítette meg.");
  } else {
    if (sure && v && n(v.secs) > 0) { const sp = timeSplit(v); say.push(`${cap(guess)}${dur(v.secs)} volt bent${n(c.ok) ? `, ${fmt(c.ok)} előnézet` : ""}${sp ? ` (${sp})` : ""}.`); }
    const fs0 = firstSig(u, sure);
    if (made) say.push(fs0 ? cap(fs0) + "." : `Elkészült ${fmt(made)} előnézete.`); else say.push("Nem készült el előnézete.");
    if (sure && reg && reg.errs.length) say.push(cap(`a regisztrációnál: ${reg.errs.join(", ")}.`));
  }
  const looks = (c.looks || []).length; if (looks > 1) say.push(`${fmt(looks)} stílust próbált.`);
  const re = regens(c); if (re.length) say.push(`Újragenerálta ugyanazt a stílust: ${re.map((r) => `${CELEB[r.style] || styleName(r.style)} ×${r.n}`).join(", ")}.`);
  const favs = saved.filter((y) => y.fav).length; if (favs) say.push(favs > 1 ? `${fmt(favs)} kedvencet jelölt.` : "Kedvencet jelölt.");
  const back = cameBack(u); if (back) say.push(back + ".");
  const days = (u.days_used || []).length; if (days > 1) say.push(`${fmt(days)} különböző napon használta.`);
  if (sure && v && v.opened) {
    if (v.shared) say.push("Meg is osztotta."); else if (n(v.saved)) say.push("Képet mentett.");
    if (n(v.errors)) say.push(`${fmt(v.errors)} hiba történt nála.`);
  }
  const reason = !mt ? "" : !sure ? CONF.gyenge[2] : mt.ch === "ai" ? aiNote(mt.ai_site) : CONF[mt.conf]?.[2] || "";
  return <section className="pp-story pe-story ink-flip"><p>{say.join(" ")}</p><small>{x.created_at ? `Regisztrált: ${dt(x.created_at)}.` : ""} {mt ? <button className="lnk" onClick={() => setWhy(!why)}>{CONF[mt.conf]?.[0] || ""}{reason ? " ⓘ" : ""}</button> : null}{why && reason ? <><br />{reason}</> : null}</small></section>;
}

/* ---------- one visit, its real events one by one (only where the match to the account is not weak) ---------- */
const authLine = (y: D) => (y.auth ? ` · ${y.auth.s === "error" ? "hiba: " + authWhy(y.auth.why) : AUTH_L[y.auth.s] || ({ tap_google: "Google-gomb", tap_apple: "Apple-gomb", tap_email: "e-mail választása", submit: "elküldte az űrlapot" } as D)[y.auth.s] || y.auth.s}` : "");
const evLine = (y: D) => `${EV[y.name] || y.name}${authLine(y)}${y.detail ? ` · ${QSTEP[y.detail] || SCR[y.detail] || CELEB[y.detail] || y.detail}` : ""}${y.val ? `: ${String(y.val).split("+").map((w) => QVAL[w] || (w.startsWith("celeb_") ? styleName(w) : w)).join(", ")}` : ""}`;
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
function VisitReplay({ tl, conf, close }: { tl: D[]; conf?: string; close: () => void }) {
  const list = useMemo(() => tl.filter((y) => y.name !== "screen_time"), [tl]);
  const [i, setI] = useState(0); const [play, setPlay] = useState(false);
  const t0 = list[0] ? Date.parse(list[0].created_at) : 0, at = (k: number) => (Date.parse(list[k]?.created_at) - t0) / 1000;
  /* the real gaps, sped up: a long pause never holds the screen for more than a second and a half */
  useEffect(() => {
    if (!play) return; if (i >= list.length - 1) { setPlay(false); return; }
    const t = setTimeout(() => setI((x) => x + 1), Math.max(320, Math.min(1500, (at(i + 1) - at(i)) * 120)));
    return () => clearTimeout(t);
  }, [play, i, list.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const cur = list[i]; const ref = useRef<HTMLOListElement>(null);
  useEffect(() => { (ref.current?.children[i] as HTMLElement | undefined)?.scrollIntoView({ block: "nearest" }); }, [i]);
  return (
    <Sheet title="A látogatás lépésről lépésre" sub={`${list.length} valódi esemény${conf === "jo" ? " · valószínűleg az ő látogatása, nem biztos" : ""}. Fotó és minta nélkül.`} close={close} tall
      foot={<div className="pp-rp-f"><button className="adm-ibtn" disabled={!i} onClick={() => { setPlay(false); setI(i - 1); }} aria-label="Előző">‹</button><button className="adm-ibtn gold" onClick={() => { if (i >= list.length - 1) setI(0); setPlay(!play); }}>{play ? "Megállítás" : i >= list.length - 1 ? "Újra" : "Lejátszás"}</button><button className="adm-ibtn" disabled={i >= list.length - 1} onClick={() => { setPlay(false); setI(i + 1); }} aria-label="Következő">›</button></div>}>
      {cur && <div className="pp-rp"><span>{clock(at(i))}<small> · {new Date(cur.created_at).toLocaleTimeString("hu-HU", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</small></span><b>{evLine(cur)}</b><input type="range" min={0} max={Math.max(0, list.length - 1)} value={i} aria-label="Hol tart" onChange={(e) => { setPlay(false); setI(Number(e.target.value)); }} /></div>}
      <ol className="pp-rp-l" ref={ref}>{list.map((y, k) => <li key={k} className={k === i ? "on" : k > i ? "later" : ""} onClick={() => { setPlay(false); setI(k); }}><time>{clock(at(k))}</time><span>{evLine(y)}</span></li>)}</ol>
    </Sheet>
  );
}

/* where the account stands by its score among all of them; only from a complete list, otherwise it says so */
function Level({ id }: { id: string }) {
  const e = useEveryone(); if (!e) return null;
  if (e.failed) return <section className="pe-lvl"><span>Szint</span><LoadErr e={e.failed} retry={e.retry} small /></section>;
  const rows = (e.rows || []) as D[], me = rows.find((x) => x.id === id), total = n(e.total);
  const whole = rows.length >= total && total >= 10 && !!me;
  const better = whole ? rows.filter((x) => n(x.score) > n(me!.score)).length : 0, rank = better + 1, top = Math.max(1, Math.ceil((rank / total) * 100));
  return <section className="pe-lvl"><span>Szint<Info>A fiók pontszáma az összes többihez mérve, a saját és tesztfiókjaid nélkül. Csak akkor számolható, ha a teljes lista megvan (legfeljebb 200 fiók), és legalább 10 fiók van.</Info></span>{whole ? <><b>A felhasználók felső {fmt(top)}%-a</b><small>{fmt(rank)}. a {fmt(total)} fiókból · pontszám: {fmt(me!.score)}</small></> : <b className="dim">Nem mérhető</b>}</section>;
}

/* the top of an account: big capital, name, three figures, one big action, four rings. The rings hold only real shares:
   made of everything tried, styles of all there are, favourites of the signatures kept on the account, days used of the days since signing up */
/* how many looks there are to try: Calligra counted its celeb looks; InkAge has no fixed list, so the ring is measured against six */
const STYLE_N = Object.keys(CELEB).length || 6;
function AccountHead({ id, u, ver, write, note, follow }: { id: string; u: D; ver: number; write: () => void; note: () => void; follow: () => void }) {
  const q = useRpc("admin_user_more", { p_id: id }, [id, ver]);
  const f: D = (q.d as D)?.facts || {}, x: D = u.user || {}, m: D = x.meta || {}, cu: D = u.celeb || {}, sv: D[] = u.saved || [];
  const made = n(f.made_ok ?? cu.ok), tried = Math.max(made, n(f.made), n(cu.total)), styles = n(f.styles ?? (cu.looks || []).length), saved = n(f.saved ?? sv.length), favs = n(f.favs ?? sv.filter((y) => y.fav).length), days = n(f.used_days ?? (u.days_used || []).length), mins = n(f.used_secs) / 60;
  const since = x.created_at ? Math.max(1, Math.round((Date.parse(bpDay(new Date().toISOString())) - Date.parse(bpDay(x.created_at))) / 864e5) + 1) : 0;
  const name = String(m.display_name || m.full_name || m.name || "").trim() || String(x.email || "").replace(/@.*/, "") || "névtelen";
  const mt: D | null = u.match || null, ul = m.lang || mt?.lang;
  const facts = [x.created_at && `regisztrált ${ago(x.created_at)}`, mt && mt.conf !== "gyenge" && PFL[mt.pf], x.provider && (PROV[x.provider] || x.provider), ul && lang(ul)].filter(Boolean);
  const rings: [string, number, number, RingKind, string][] = [
    ["előnézet", made, tried, "solid", tried ? `${fmt(made)} / ${fmt(tried)} sikerült` : "még nincs"],
    ["stílus", styles, STYLE_N, "tick", `${fmt(styles)} / ${fmt(STYLE_N)} stílus`],
    ["kedvenc", favs, saved, "dots", saved ? `${fmt(favs)} / ${fmt(saved)} előnézetből` : "nincs előnézete"],
    ["nap", days, since, "seg", since ? `${fmt(Math.min(days, since))} / ${fmt(since)} napon használta` : "–"],
  ];
  return (
    <>
      <div className="pe-prof">
        <Mono name={name} badge={made || null} size={136} />
        <h2>{name}</h2>
        <small>{x.email || "nincs e-mail-címe"}{f.online ? " · ● most aktív" : ""}</small>
        {/* where they came from comes first: an estimate from the nearest visit, its confidence beside it (a tap explains) */}
        <div className="pe-from"><SrcTag c={mt?.ch} conf={mt?.conf} site={mt?.ai_site} /><small>{facts.join(" · ")}</small></div>
        <div className="pe-three">
          <div><b>{fmt(made)}</b><small>előnézet</small></div>
          <div><b>{fmt(styles)}</b><small>stílus</small></div>
          <div><b>{made || saved ? fmt(mins, mins < 10 ? 1 : 0) : "–"}</b><small>perc legalább</small></div>
        </div>
        <button className="pe-go" disabled={!x.email} onClick={write}>Írás neki</button>
        <div className="pe-go2"><button className="adm-ibtn" onClick={note}>Jegyzet</button><button className="adm-ibtn" onClick={follow}>Visszakeresés</button></div>
      </div>
      <div className="pe-rings">{rings.map(([l, a, b, k, s]) => <div key={l}><Ring p={b ? a / b : 0} kind={k} label={`${l}: ${s}`}><b>{fmt(a)}</b></Ring><em>{l}</em><small>{s}</small></div>)}</div>
      <Level id={id} />
      <section className="pe-bdg" aria-label="Jelvények"><h3 className="ink-h">Jelvények</h3><ul>{([["Visszajött", !!f.returned || !!cameBack(u), "Egy későbbi napon is használta"], ["Hat stílus", styles >= 6, "Legalább hat stílust próbált"], ["Első nap", !!cu.first_at && !!x.created_at && bpDay(cu.first_at) === bpDay(x.created_at), "A regisztráció napján elkészült az előnézete"], ["Öt előnézet", made >= 5, "Legalább öt előnézete készült el"], ["Kedvenc", favs > 0, "Kedvencet jelölt"]] as [string, boolean, string][]).map(([l, on, why]) => <li key={l} className={on ? "on" : ""} title={why}><i aria-hidden="true">{on ? "✓" : "–"}</i><span>{l}<small>{on ? why : "még nem"}</small></span></li>)}</ul></section>
    </>
  );
}

/* the account's page: the person on the left (on a phone, on top), the story and the images beside it; everything else below them */
const PE_TABS: ["sig" | "path" | "notes" | "act", string, string][] = [["sig", "Előnézetek", P.pen], ["path", "Út", P.traffic], ["notes", "Jegyzetek", P.doc], ["act", "Műveletek", P.bolt]];
function Account({ id, u, parts, ver, changed, openOther }: { id: string; u: D; parts: { sigs: ReactNode; journey: ReactNode; steps: ReactNode; acct: ReactNode; more: (t: "sig" | "path" | "notes" | "act") => ReactNode }; ver: number; changed?: () => void; openOther?: (id: string) => void }) {
  const [act, setAct] = useState<PAct | null>(null); const [rp, setRp] = useState(false); const [tab, setTab] = useState<"sig" | "path" | "notes" | "act">("sig");
  const x: D = u.user || {}, m: D = x.meta || {}, mt: D | null = u.match || null, tl: D[] = u.timeline || [];
  const row: D = { id, email: x.email, lang: m.lang || mt?.lang, made_ok: u.celeb?.ok };
  return (
    <div className="pe-acct">
      <div className="pe-side"><AccountHead id={id} u={u} ver={ver} write={() => setAct({ k: "mail", x: row })} note={() => setAct({ k: "note", x: row })} follow={() => setAct({ k: "follow", x: row })} /></div>
      <div className="pe-main">
        <AccountStory u={u} />
        <DupeHint id={id} open={(o) => openOther?.(o)} />
        <div className="pe-tabs" role="tablist" aria-label="A fiók részei">{PE_TABS.map(([k, l, ic]) => <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{I(ic)}<span>{l}</span></button>)}</div>
        {tab === "sig" && <SigGallery id={id} list={u.celeb?.list} />}
        {tab === "path" && mt && tl.length > 1 && (mt.conf === "gyenge" ? <p className="note">A látogatása nem játszható vissza: nem tudjuk biztosan, hogy az övé.</p> : <button className="pp-hint pe-hint" onClick={() => setRp(true)}>A látogatás visszajátszása lépésről lépésre ›</button>)}
        {/* the same UserMore stays mounted through the tabs, so a half-written note is not lost */}
        <div className="pe-all">{tab === "sig" && parts.sigs}{tab === "path" && parts.journey}{parts.more(tab)}{tab === "path" && parts.steps}{tab === "act" && parts.acct}</div>
      </div>
      <ActSheets a={act} close={() => setAct(null)} done={changed} />
      {rp && <VisitReplay tl={tl} conf={mt?.conf} close={() => setRp(false)} />}
    </div>
  );
}

export function UserDrawer({ id, close, changed, openOther }: { id: string; close: () => void; changed?: () => void; openOther?: (id: string) => void }) {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [u, setU] = useState<D | null>(null); const [uv, setUv] = useState(0); const [uErr, setUErr] = useState("");
  useEffect(() => { setUErr(""); rpc(sb, "admin_user", { p_id: id }).then(({ data, error }) => { if (error) { setUErr(error.message); return; } setU(data as D); const m = String((data as D)?.email || (data as D)?.user?.email || ""); pushRecent({ k: "user", id, l: m || "Egy ember" }); }); }, [sb, id, uv]);
  /* the open card follows the visit live: reloaded every 10 seconds while the page is in view */
  useEffect(() => { const iv = setInterval(() => { if (document.visibilityState === "visible") rpc(sb, "admin_user", { p_id: id }).then(({ data }) => data && setU(data as D)); }, 10_000); return () => clearInterval(iv); }, [sb, id]);
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === "Escape" && close(); addEventListener("keydown", k); return () => removeEventListener("keydown", k); }, [close]);
  const x = u?.user || {}, m = x.meta || {}, mt: D | null = u?.match || null;
  const src = mt?.src || m.src;
  /* the extra TikTok / Instagram account whose bio link brought the visit (Fiókok page), by the link's code */
  const codes = useRpc("admin_extra_codes", undefined, []).d as D | null;
  const viaAcc: D | null = (src?.ux && codes?.[String(src.ux)]) || null;
  return (
    <Layer>
      <div className="scrim" onClick={close} />
      <aside className="drawer pe-dr" role="dialog" aria-label="Felhasználó">
        <div className="c-h"><div><span className="eyebrow">Felhasználó</span></div><CloseX close={close} /></div>
        {uErr && !u ? <LoadErr e={uErr} retry={() => setUv((v) => v + 1)} /> : !u ? <div className="skel" style={{ height: 240 }} /> : !u.user ? <Empty t="Ez a fiók már nem létezik (törölve)." /> : (
          <>
            {/* the signatures first; the visit, the notes and the actions each on their own tab */}
            {(() => { /* an attempt that failed has no picture; every other signature is one image in the gallery above, not a second time here */
              const noImg = ((u.celeb?.list || []) as D[]).filter((c) => !c.ok); const acct = <>
            <h3>Fiók</h3>
            <dl className="kv">
              <dt>Név</dt><dd>{m.display_name || m.full_name || m.name || "–"}</dd>
              <dt>Regisztrált</dt><dd>{dt(x.created_at)}</dd>
              <dt>Utolsó belépés</dt><dd>{dt(x.last_sign_in_at)} <small className="mut">(aki bent marad, újra nem lép be: nem a visszatérést mutatja)</small></dd>
              <dt>Belépés módja</dt><dd>{PROV[x.provider] || x.provider}</dd>
              <dt>E-mail megerősítve</dt><dd>{x.email_confirmed_at ? dt(x.email_confirmed_at) : x.provider !== "email" ? "nem kell (" + (PROV[x.provider] || x.provider) + ")" : <span className="chip warn">még nem</span>}</dd>
              <dt>Nyelv</dt><dd>{lang(m.lang || mt?.lang || "?")}{!m.lang && mt?.lang ? <small className="mut"> (a regisztráló látogatásból)</small> : null}</dd>
              <dt>Forrás</dt><dd>{mt ? <><SrcTag c={mt.ch} conf={mt.conf} site={mt.ai_site} />{viaAcc && <span className="chip gold" style={{ marginLeft: 6 }}>fiók: {viaAcc.label}{viaAcc.country ? ` (${viaAcc.country})` : ""}</span>}{mt.conf !== "gyenge" ? <> · {PFL[mt.pf] || mt.pf}{src ? <small className="mut"> · {Object.entries(src).map(([k, v]) => `${k}: ${v}`).join(" · ")}</small> : null}</> : null}<br /><small className="mut">a regisztráció idejéhez legközelebbi látogatás (…{mt.session}{mt.near_secs != null ? `, ${dur(mt.near_secs)} távolság` : ""})</small></> : <SrcTag />}</dd>
              <dt>Üdvözlő e-mail</dt><dd>{m.welcome_sent_at ? dt(m.welcome_sent_at) : "nem ment ki"}</dd>
              <dt>Azonosító</dt><dd style={{ fontSize: 12, color: "var(--a-dim)" }}>{x.id}</dd>
            </dl>
            <p className="note">Ügyfélszolgálati nézet. Ne add ki harmadik félnek. Minden művelet (felfüggesztés, export, törlés, e-mail) a Naplóba kerül; törölni csak a felhasználó kérésére szabad.</p>
            </>, sigs = !noImg.length ? null : <>
            <h3>Amiről nincs kép ({fmt(noImg.length)})</h3>
            {noImg.map((c, i) => (
              <div key={i} className="namecard"><b className="nm-cal">{String(c.name_norm).replace(/(^|\s)\S/g, (w) => w.toUpperCase())}</b><span style={{ fontSize: 12, textAlign: "right" }}><span className="chip gold">{CELEB[c.style] || c.style}</span>{c.initials ? <span className="chip">monogram</span> : null}{!c.ok && <span className="chip warn">nem sikerült</span>} {ago(c.created_at)}</span></div>
            ))}
            </>, steps = <>
            <h3>A regisztráló látogatás lépései</h3>
            {(u.timeline || []).length ? <TLine items={(u.timeline as D[]).slice().reverse().map((y) => ({ ic: /error|failed/.test(y.name) ? P.alert : y.name === "flow_step" ? P.pen : /share/.test(y.name) ? P.share : /save|mail/.test(y.name) ? P.doc : y.name === "landing_view" ? P.eye : y.name === "screen_time" ? P.clock : P.arrow, on: y.name === "flow_step", warn: /error|failed/.test(y.name), at: new Date(y.created_at).toLocaleString("hu-HU", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
              t: `${EV[y.name] || y.name}${authLine(y)}${y.detail ? ` · ${QSTEP[y.detail] || SCR[y.detail] || y.detail}` : ""}${y.secs ? ` · ${dur(y.secs)}` : ""}${y.val ? `: ${String(y.val).split("+").map((w) => QVAL[w] || w).join(", ")}` : ""}`, sub: y.ch && y.ch !== "közvetlen" ? <><Logo k={y.ch} size={14} />{ch(y.ch)}</> : undefined }))} /> : <Empty t="Ehhez a fiókhoz nincs látogatás (iPhone-app, vagy a mérés nem látta)." />}
            {(u.days || []).length > 0 && <p className="note">Napok, amikor a fiók be volt lépve vagy használta: {(u.days as string[]).map((y) => new Date(y).toLocaleDateString("hu-HU", { month: "short", day: "numeric" })).join(" · ")}</p>}
            </>; return <Account id={id} u={u} ver={uv} changed={() => { setUv((v) => v + 1); changed?.(); }} openOther={openOther} parts={{ sigs, journey: <Journey u={u} />, steps, acct, more: (t) => <UserMore part={t} ver={uv} id={id} email={x.email || ""} lang={m.lang || mt?.lang} reload={() => { setUv((v) => v + 1); changed?.(); }} /> }} />; })()}
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
  return <TRows name="leadek" rows={rows} empty="Ebben az időszakban nem volt regisztráció." cols={[
    { k: "ch", l: "Csatorna", r: (r) => <SrcTag c={r.matched ? r.ch || "közvetlen" : null} conf={r.conf} site={r.ai_site} /> },
    { k: "at", l: "Mikor", r: (r) => <span title={dt(r.at)}>{ago(r.at)}</span> },
    { k: "pf", l: "Eszköz", r: (r) => (r.pf ? PFL[r.pf] || r.pf : "–") },
    { k: "provider", l: "Mód", r: (r) => PROV[r.provider] || r.provider || "–" },
    { k: "post_title", l: "Link / poszt", r: (r) => (r.post_title ? <a href={r.post_url || undefined} target="_blank" rel="noreferrer" className="cellwrap" style={{ textDecoration: "none" }}>{PF[r.post_platform] || r.post_platform}: {String(r.post_title).slice(0, 50)}</a> : r.code ? <b>{r.code}</b> : <span className="mut">–</span>) },
    { k: "celeb", l: "Előnézet", num: true, r: (r) => (n(r.celeb) ? fmt(r.celeb) : "–") }, { k: "saved", l: "Eltárolt", num: true, r: (r) => (n(r.saved) ? fmt(r.saved) : "–") }, { k: "favs", l: "Kedvenc", num: true, r: (r) => (n(r.favs) ? fmt(r.favs) : "–") },
    { k: "lang", l: "Nyelv", r: (r) => lang(r.lang || "?") },
    { k: "secs", l: "Bent (becslés)", r: (r) => (r.matched && r.conf !== "gyenge" && r.secs != null ? dur(r.secs) : "–") },
    { k: "captured", l: "Bőrfotó", r: (r) => (r.conf !== "gyenge" && r.captured ? "✓" : "–") },
    { k: "result_secs", l: "Eredményen", r: (r) => (r.conf !== "gyenge" && r.result_secs != null ? dur(r.result_secs) : "–") },
    { k: "shots", l: "Képernyőkép", r: (r) => (r.conf !== "gyenge" && n(r.shots) ? fmt(r.shots) : "–") },
    { k: "shared", l: "Megosztott", r: (r) => (r.conf !== "gyenge" && r.shared ? "✓" : "–") },
  ]} />;
}
