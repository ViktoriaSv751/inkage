"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { ACC, BarList, Columns, CountUp, Delta, Empty, Info, Sankey, Spark, StackedColumns, TrendChart, fmt, pct } from "../charts";
import { HourClock, Logo } from "../wow";
import { CH, CTAK, Card, DOW, FreshRow, Kpi, Layer, Mini, P, PF, SOC, Tbl, ago, barCell, big, bpDate, ch, chCol, lang, n, pctCell, periodName, periodWords, rpc, secs, type D, useBlockRpc, useFlt, useRpc , series } from "../shared";
/* InkAge takes no payments yet: no payer numbers anywhere on this page */
const paymentsOn = (_native: boolean) => false;
import { CloseX, usePhone, type TblCol } from "../phone";
import { PhMore, aiNote } from "./people";
import { Chg, Giant, Hero } from "../ink";
import { More } from "../extra";

/* visits without a known source: the direct ones, the Android app's opens (a device, not a source), and someone coming back on their own */
const NOSRC = new Set(["közvetlen", "androidapp", "visszatérő"]);
/* a sign-in coming back, or the site itself, is not a site that sent the visitor */
const SELF = new Set(["accounts.google.com", "appleid.apple.com", "inkage.app", "www.inkage.app", "checkout.stripe.com"]);
/* when the measuring itself changed: a comparison across one of these dates is not like with like */
/* InkAge: no measuring change is recorded yet; add [date, what changed] here when one happens */
const BREAKS: [string, string][] = [];
export const breakNote = (d: D) => {
  const to = new Date(d.to || Date.now()).getTime(), from = new Date(d.from || to).getTime(), start = from - (to - from);
  const hit = BREAKS.filter(([t]) => { const x = new Date(t + "T00:00:00+02:00").getTime(); return x > start && x <= to; });
  return hit.length ? `Figyelem, az előző időszakkal való összevetés mérésváltáson ível át: ${hit.map(([t, l]) => `${l} (${t.slice(5).replace("-", ". ")}.)`).join(", ")}. A nyilakat ezért óvatosan olvasd.` : "";
};

/* the channels the classification tells apart besides the ones the shared list names (X, Threads, Reddit, messengers,
   e-mail clients, Google Play, Google Ads, Bing on its own) */
Object.assign(CH, { x: "X (Twitter)", threads: "Threads", reddit: "Reddit", whatsapp: "WhatsApp", messenger: "Messenger", telegram: "Telegram", bing: "Bing", play: "Google Play", ads: "Google Ads", ismeretlen: "Nem párosítható" });

/* the period of the dashboard, for the page's own database calls */
export const per = (d: D) => ({ p_days: n(d.days) || 30, p_from: d.filter?.from ? d.from : null, p_to: d.filter?.from ? d.to : null });
const PFL: Record<string, string> = { web: "Weboldal", android: "Android-app (becslés)", ios: "iPhone-app", ismeretlen: "Nem párosítható" };
const SIGNUP_NOTE = "Becslés: a regisztrációt az időben legközelebbi, azonos nyelvű névtelen látogatáshoz kötjük (a mérés fiókot nem tárol). Biztos: a látogatás maga küldte a regisztrációt, vagy az előnézetei ott készültek. Jó: egy percen belüli, és semmi nem mond ellene. Gyenge: távolabbi, vagy más fiók is regisztrált akkor. Az iPhone-app nem küld adatot, ezért az ottani regisztráció is egy közeli, idegen látogatáshoz kerülhet: ez a gyengék között van. Az Android-app sem küld regisztrációs eseményt.";

/* the "ai" row, split by the real site: "ChatGPT · 4 látogatás · 1 fiók"; a tap says what cannot be known */
function AiSites({ d }: { d: D }) {
  const q = useRpc("admin_ai_sites", per(d), [d.days, d.from]); const [open, setOpen] = useState(false);
  const rows: D[] = Array.isArray(q.d) ? q.d : [];
  if (!rows.length) return null;
  return <small className="ai-sites" role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); setOpen(!open); }}>{rows.map((x) => `${x.k}: ${fmt(x.sessions)} látogatás, ${fmt(x.signups)} fiók`).join(" · ")} ⓘ{open && <><br />{aiNote(rows.length === 1 && rows[0].k !== "Más MI-kereső" ? rows[0].k : null)}</>}</small>;
}

/* ---------- pieces the insight pages share: the top slot of the page grid, a row with a right-aligned two-line value, a change in points ---------- */
export const Top = ({ children, pc }: { children: React.ReactNode; pc?: boolean }) => <div className={"s12 ix-top" + (pc ? " pc" : "")}>{children}</div>;
export function IRow({ ic, t, s, v, vs, on }: { ic?: React.ReactNode; t: React.ReactNode; s?: React.ReactNode; v?: React.ReactNode; vs?: React.ReactNode; on?: () => void }) {
  const body = <>{ic && <span className="ix-r-ic">{ic}</span>}<span className="ix-r-m"><b>{t}</b>{s && <small>{s}</small>}</span>{(v != null || vs != null) && <span className="ix-r-v"><b>{v}</b>{vs != null && <small>{vs}</small>}</span>}</>;
  return on ? <button type="button" className="ix-r" onClick={on}>{body}</button> : <div className="ix-r">{body}</div>;
}
export function ChgP({ a, b, tail }: { a: number; b: number; tail?: string }) {
  const x = Math.round(a * 10) / 10, y = Math.round(b * 10) / 10;
  return <span className={"ink-chg " + (x === y ? "same" : x > y ? "up" : "down")}>{x === y ? "= ugyanannyi" : `${x > y ? "↑" : "↓"} ${fmt(Math.abs(x - y), 1)} pont`}{tail ? <small>{tail}</small> : null}</span>;
}

/* ---------- a wide table as designed rows: the first column heads the row, every other one is a small labelled figure. Sorting and the CSV work as in Tbl; on a phone the shared card view, unless `all` ---------- */
export function TRows({ cols, rows, empty = "Még nincs adat ebben az időszakban.", onRow, name = "inkage", csv = true, all, dense }: { cols: TblCol[]; rows: D[]; empty?: string; onRow?: (r: D) => void; name?: string; csv?: boolean; all?: boolean; dense?: boolean }) {
  const phone = usePhone();
  const [sk, setSk] = useState<string | null>(null); const [dir, setDir] = useState<1 | -1>(-1);
  const sorted = useMemo(() => {
    if (!sk || !rows) return rows || [];
    const val = (r: D) => { const v = r[sk], x = typeof v === "number" ? v : Number(v); return v == null || v === "" ? -Infinity : Number.isFinite(x) && String(v).trim() !== "" ? x : String(v).toLowerCase(); };
    /* names in Hungarian alphabetical order; a figure before a word */
    return [...rows].sort((a, b) => { const x = val(a), y = val(b); return (typeof x === "string" && typeof y === "string" ? x.localeCompare(y, "hu") : typeof x !== typeof y ? (typeof x === "string" ? 1 : -1) : x < y ? -1 : x > y ? 1 : 0) * dir; });
  }, [rows, sk, dir]);
  if (phone && !all) return <Tbl cols={cols} rows={rows} empty={empty} onRow={onRow} name={name} csv={csv} />;
  if (!rows?.length) return <Empty t={empty} />;
  /* a column with no value of its own (a drawn trend) cannot be sorted or exported */
  const use = cols.filter((c) => c.l && rows.some((r) => r[c.k] != null));
  const sortBy = (k: string) => { if (sk === k) setDir(dir === 1 ? -1 : 1); else { setSk(k); setDir(-1); } };
  const download = () => {
    const esc = (v: unknown) => { let t = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v); if (typeof v === "string" && /^[=+\-@\t\r]/.test(t)) t = "'" + t; return /[";\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
    const body = [use.map((c) => c.l).join(";"), ...sorted.map((r) => use.map((c) => esc(r[c.k])).join(";"))].join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["\ufeff" + body], { type: "text/csv;charset=utf-8" }));
    a.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  const [h, ...rest] = cols;
  return <div className={"ix-tr" + (dense ? " dense" : "")}>
    <div className="ix-tr-bar"><div className="ix-tr-sort" role="group" aria-label="Rendezés">{use.map((c) => <button key={c.k} type="button" aria-pressed={sk === c.k} onClick={() => sortBy(c.k)}>{c.l}{sk === c.k ? (dir === 1 ? " ↑" : " ↓") : ""}</button>)}</div>
      {csv && <span className="ix-tr-csv"><small>{fmt(rows.length)} sor</small><button type="button" className="lnk" onClick={download}>CSV ⤓</button></span>}</div>
    <ul>{sorted.map((r, i) => <li key={i}><div className={"ix-tr-r" + (onRow ? " click" : "")} {...(onRow ? { role: "button", tabIndex: 0, onClick: () => onRow(r), onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Enter") onRow(r); } } : {})}>
      <div className="ix-tr-h">{h.r ? h.r(r) : r[h.k] ?? "–"}</div>
      <div className="ix-tr-c">{rest.map((c) => <div key={c.k}><small>{c.l}</small><span>{c.r ? c.r(r) : r[c.k] ?? "–"}</span></div>)}</div>
    </div></li>)}</ul>
  </div>;
}

/* ---------- one thick bar split into the sources by pattern: the same split as the known-source share, the parts add up to the total ---------- */
const PATS = 5;
function SplitBar({ chans, total: all, onPick }: { chans: D[]; total: number; onPick: (k: string) => void }) {
  const known = chans.filter((c) => !NOSRC.has(c.k) && n(c.sessions) > 0).sort((a, b) => n(b.sessions) - n(a.sessions));
  const kn = known.reduce((s, c) => s + n(c.sessions), 0), total = Math.max(all, kn), unk = total - kn;
  /* one left over has room for its own name; only two or more go together, and those are named behind the ⓘ */
  const named = known.length <= PATS ? PATS : PATS - 1;
  const top = known.slice(0, named), rest = known.slice(named), restN = rest.reduce((s, c) => s + n(c.sessions), 0);
  const parts: { k: string; l: string; v: number; p: string; pick?: boolean }[] = [...top.map((c, i) => ({ k: c.k as string, l: ch(c.k), v: n(c.sessions), p: "p" + i, pick: true })), ...(restN ? [{ k: "_more", l: `Még ${fmt(rest.length)} forrás`, v: restN, p: "p4" }] : []), ...(unk ? [{ k: "_unk", l: "Ismeretlen forrás", v: unk, p: "pu" }] : [])];
  if (!total || !parts.length) return null;
  return <div className="ix-split">
    <div className="ix-bar" role="img" aria-label={parts.map((x) => `${x.l}: ${fmt(x.v)}`).join(", ")}>{parts.map((x) => <i key={x.k} className={x.p} style={{ flexGrow: x.v }} />)}</div>
    <ul className="ix-leg">{parts.map((x) => { const body = <><i className={x.p} /><span>{x.l}{x.k === "_unk" && <Info>{fmt(x.v)} látogatás link nélkül érkezett: közvetlen, Android-app vagy visszatérő. Rövid linkkel ez csökken.</Info>}{x.k === "_more" && <Info>{rest.map((c) => `${ch(c.k)}: ${fmt(c.sessions)}`).join(", ")}.</Info>}</span><b>{fmt(x.v)}</b><small>{pct(x.v, total)}</small></>;
      return <li key={x.k}>{x.pick ? <button type="button" onClick={() => onPick(x.k)} aria-label={`${x.l}: a csatorna oldala`}>{body}</button> : <div>{body}</div>}</li>; })}</ul>
  </div>;
}
/* ---------- traffic ---------- */
/* the channels with their period before and the sign-ups (estimated); the dashboard's list until it arrives */
const chansOf = (T: D, d: D) => T.channels || d.channels || [];
export function Traffic({ d }: { d: D }) {
  const N = d.now || {}, PV = d.prev || {};
  const { f, set } = useFlt();
  const t = useRpc("admin_traffic", { ...per(d), p_ch: f.ch || null, p_lang: f.lang || null }, [d.days, d.from, f.ch, f.lang]);
  const T: D = (t.d as D) || {};
  /* "Csatornák: a teljes út" with a period of its own (the page's while it says "Mint fölül") */
  const cb = useBlockRpc("admin_traffic", { p_ch: f.ch || null, p_lang: f.lang || null }, [f.ch, f.lang]);
  const CT: D = cb.own ? ((cb.q.d as D) || {}) : T;
  const cChans = ((cb.own ? CT.channels || [] : chansOf(T, d)) as D[]).filter((c) => n(c.sessions) || n(c.signups));
  const cMax = Math.max(1, ...cChans.map((c) => n(c.sessions)));
  /* the channels with their period before and the sign-ups (estimated); the dashboard's list until it arrives */
  const chans = (chansOf(T, d) as D[]).filter((c) => n(c.sessions) || n(c.signups));
  const keys = chans.map((c) => c.k);
  const byDay = new Map<string, Record<string, number>>();
  (d.channel_trend || []).forEach((x: D) => { const m = byDay.get(x.t) || {}; m[x.k] = n(x.n); byDay.set(x.t, m); });
  const days = (d.trend || []).map((x: D) => ({ t: x.t, v: byDay.get(x.t) || {} }));
  const maxS = Math.max(1, ...chans.map((c) => n(c.sessions)));
  const hours = Array.from({ length: 24 }, (_, h) => ({ k: String(h), v: n(((T.hours || d.hours || []) as D[]).find((x: D) => x.h === h)?.n), tip: `${h}:00–${h}:59` }));
  const bestH = [...hours].sort((a, b) => b.v - a.v)[0];
  /* the share of known sources is over the active visits: a single open from nowhere says nothing either way */
  const kn = T.known || {}, identified = n(kn.now), total = n(kn.engaged) || n(kn.all) || n(N.sessions), prevTotal = n(kn.prev_engaged) || n(kn.prev_all);
  const engaged = n(T.engaged), doors = n(T.doors), brk = breakNote(d);
  const measured = useMemo(() => (T.measured ? new Set<string>(T.measured as string[]) : null), [T.measured]);
  const notMeasured = (k: string, sessions: unknown) => !!measured && !n(sessions) && !measured.has(k);
  const topK = chans.filter((c) => !NOSRC.has(c.k))[0];
  const [open, setOpen] = useState<string | null>(null); const [tbl, setTbl] = useState(false);
  const du = T.duration || {}, dup = T.duration_prev || {};
  const pfs: D[] = T.platforms || [], pfp: D[] = T.platforms_prev || [];
  const su = T.signups || {};
  const pfRows = ((T.platform_path || []) as D[]).filter((r) => n(r.views) || n(r.sessions) || n(r.clicks));
  const wk = Array.from({ length: 7 }, (_, i) => ({ k: DOW[i + 1].slice(0, 3), v: n(((T.weekdays || d.weekdays || []) as D[]).find((x: D) => n(x.w) === i + 1)?.n), tip: DOW[i + 1] }));
  const phone = usePhone();
  const referrers = ((d.referrers || []) as D[]).filter((r) => !SELF.has(r.k));
  return (
    <div className="g ix">
      <Top><Hero flip label={<>Látogatás {periodName(d)}<Info>A forrás a látogatás első oldaláé (utm-jelölés, hivatkozó oldal), és a látogatás végéig megmarad. Látogatásokon átívelő követés nincs: a mérés névtelen, két látogatást nem kötünk össze, így egy ember több látogatás is lehet. {T.engaged != null ? <><b>{fmt(engaged)}</b> aktív látogatás (legalább két esemény, vagy ismert forrás), és <b>{fmt(doors)}</b> egyetlen megnyitás forrás nélkül (főoldal, /app, belépés): ez lehet ember és gép is. </> : null}Az aktív látogatások <b>{pct(identified, total)}</b>-ánál tudjuk, honnan jöttek{topK ? <>; a legerősebb azonosított csatorna: <b>{ch(topK.k)}</b> ({fmt(topK.sessions)} látogatás, {pct(n(topK.scored), n(topK.sessions))} előnézetig)</> : ""}. A cikkoldalak egy megnyitásos, forrás nélküli látogatásait gépi forgalomnak vesszük, ezek nincsenek a számokban. {brk}</Info></>} v={n(N.sessions)}
        chg={d.prev_partial ? undefined : <Chg a={n(N.sessions)} b={n(PV.sessions)} tail="az előző időszakhoz" />} side={<SplitBar chans={chans.filter((c) => c.k !== "visszatérő")} total={n(N.sessions)} onPick={setOpen} />} /></Top>
      <section className="s12 ix-swipe-s"><ChCards chans={chans} trend={d.channel_trend || []} onPick={(k) => setOpen(k)} notMeasured={notMeasured} only={f.ch ? f.ch.split(",") : null} /></section>
      <FreshRow srcs={["events", ...SOC]} />
      {phone && <SourceRank d={d} chans={chans} onPick={setOpen} />}
      {phone && <PostsBrought rows={(T.campaigns || d.campaigns || []) as D[]} />}
      {phone && <Spikes d={d} />}
      <Kpi kind="own" to="funnel" tone="butter" className="s3" icon={P.doc} l="Aktív látogatás" v={<CountUp v={engaged || n(N.sessions)} />} now={engaged || n(N.sessions)} prev={n(T.prev_engaged) || n(PV.sessions)} title={`Legalább két esemény, vagy ismert forrás. Weboldalt látott ${fmt(N.landing)} (az Android-app nyitóoldalával).`} sub={<span>a {fmt(N.sessions)} látogatásból</span>} />
      <Kpi kind="own" to="@next" tone="pink" className="s3" icon={P.target} l="Ismert forrásból" v={pct(identified, total)} now={total ? identified / total : 0} prev={prevTotal ? n(kn.prev) / prevTotal : 0} title={`Nem számít ide az Android-app (${fmt(kn.android)}, ott nem látszik, honnan jött) és a visszatérő (${fmt(kn.returning)}).`} sub={<span>{fmt(identified)} aktív látogatásnál · előtte {pct(n(kn.prev), prevTotal)}</span>} />
      {/* the median of the time in use: a gap of over 5 minutes is a tab left open and counts as nothing */}
      <Kpi kind="own" to="@next" tone="sky" className="s3" icon={P.clock} l="Látogatás hossza (medián)" v={secs(du.median ?? d.session_len?.median_sec)} now={n(du.median)} prev={d.prev_partial ? undefined : n(dup.median)} sub={<span>75%-uk {secs(du.p75 ?? d.session_len?.p75_sec)} alatt · átlag {secs(du.mean_capped ?? du.mean)}</span>} title={`A legalább két eseményes látogatások középső hossza, a tétlen szünetek nélkül (az 5 percnél hosszabb szünet nem számít). Egy eseményből nem számolható hossz, ezért azok nincsenek benne.${du.n != null ? ` Ennyi látogatásból számolva: ${fmt(du.n)}, összesen ${fmt(du.all)} volt.` : ""}`} />
      <Kpi spark={series(d, "signups")} kind="est" to="users" tone="peach" className="s3" icon={P.user} l="Regisztráció (becslés)" v={fmt(su.n)} now={n(su.n)} prev={n(su.prev)} sub={<span>{su.sure != null ? <>{fmt(su.sure)} tudjuk, honnan · {fmt(su.good)} valószínű · {fmt(n(su.weak) + n(su.none))} nem tudjuk</> : <>{fmt(su.matched)} párosítva látogatáshoz</>}</span>} title={SIGNUP_NOTE} />

      <PhMore label="Weboldal és Android-app, napi bontás, a posztoktól a fiókig">
      <Card className="s12" icon={P.eye} title="Weboldal és Android-app" sub="A weboldal 2026. okt. 23. óta minden eseménnyel elküldi, hogy weboldal; ami ezt nem küldi, az a Google Play-es Android-app (ez az /app oldalon nyílik). Előtte becslés volt. Az iPhone-app nem küld adatot: egyik számban sincs benne.">
        {pfs.length ? <div className="mini-stats" style={{ gridTemplateColumns: `repeat(${Math.min(4, pfs.length + 1)},1fr)` }}>
          {pfs.map((x) => { const pv = n(pfp.find((y) => y.k === x.k)?.n); return <Mini key={x.k} l={PFL[x.k] || x.k} v={fmt(x.n)} sub={<>{pct(n(x.scored), n(x.n))} előnézetig · <Delta now={n(x.n)} prev={pv} /></>} />; })}
          <Mini l="iPhone-app" v="–" sub="nem küld adatot" />
        </div> : <Empty t="Még nincs látogatás ebben az időszakban." />}
      </Card>

      <Card className="s12" icon={P.layers} title="Látogatások csatornánként, naponta" sub="Minden oszlop egy nap; a színek a csatornák, az egyetlen megnyitásokkal együtt. A szürke: forrás nélkül érkezett (beírta a címet, vagy appból jött, ahonnan a böngésző nem adja át, hol volt)."
        right={<div className="adm-seg sm"><button aria-pressed={!tbl} onClick={() => setTbl(false)}>Grafikon</button><button aria-pressed={tbl} onClick={() => setTbl(true)}>Táblázat</button></div>}
        foot={<div className="legend">{keys.map((k) => <span key={k}><i className="sq" style={{ background: chCol(k) }} />{ch(k)}</span>)}</div>}>
        {tbl ? <Tbl name="csatornak-naponta" rows={days.map((x: D) => ({ t: String(x.t).slice(0, 10), ...Object.fromEntries(keys.map((k) => [k, n(x.v[k])])), total: keys.reduce((s, k) => s + n(x.v[k]), 0) }))}
          cols={[{ k: "t", l: "Nap", ph: "name" as const }, ...keys.map((k) => ({ k, l: ch(k), num: true })), { k: "total", l: "Összesen", num: true, ph: "main" as const, r: (r: D) => <b>{fmt(r.total)}</b> }]} />
          : <StackedColumns days={days} keys={keys} label={ch} color={chCol} />}
      </Card>
      </PhMore>

      <Card className="s12" icon={P.funnel} title="Az út csatornánként" sub="Az aktív látogatások, balról jobbra: honnan jöttek, megnyitották-e az appot, feltöltöttek-e bőrfotót vagy kihagyták, megkapták-e az előnézetet, megnézték-e 50 év múlva, és megosztották-e (a mentés nem megosztás). A kihagyók is a folyamban maradnak.">
        <div className="ph-hide"><SankeyFlow chans={(T.flow as D[]) || chans} /></div>
        {/* on a phone the flow reads as a list: each channel and how far its visitors get */}
        <ul className="jlist ph-only">{(((T.flow as D[]) || chans) as D[]).filter((c) => n(c.sessions) > 0).map((c) => (
          <li key={c.k} role="button" tabIndex={0} onClick={() => setOpen(c.k)} onKeyDown={(e) => { if (e.key === "Enter") setOpen(c.k); }}>
            <div className="jl-h"><Logo k={c.k} size={30} /><b>{ch(c.k)}</b><em>{fmt(c.sessions)}</em></div>
            <div className="jl-steps">{([["app", "App"], ["scored", "Előnézet"], ["revealed", "50 év múlva"], ["shared", "Megosztás"]] as const).map(([k, l]) => (
              <span key={k}><i style={{ width: `${Math.max(3, (n(c[k]) / Math.max(1, n(c.sessions))) * 100)}%`, background: chCol(c.k) }} /><small>{l}</small><b>{pct(n(c[k]), n(c.sessions))}</b></span>
            ))}</div>
          </li>
        ))}</ul>
      </Card>

      {pfRows.length > 0 && <PhMore label="A posztoktól a fiókig, platformonként"><Card className="s12" icon={P.social} title="A posztoktól a fiókig, platformonként" sub={<>Balra a platform saját száma: a posztjaid megtekintései, amennyivel az időszakban nőttek (nem az élettartam-összeg); a Google-nél a keresési megjelenés és kattintás a Google napi összesítőjéből (a mai, félkész nappal; a Google nem tud a csatorna- és nyelvszűrőről, ezért az ő száma szűrve sem változik). A Google teljes napokat számol, tehát 7 napnál 7 napot. Jobbra a mi mérésünk: rövid link-kattintás (csak ott mérhető, ahol van rövid link; az Instagram bio linkje nem az, ezért ott van látogatás kattintás nélkül), látogatás, előnézet, regisztráció. Ahol „nem mérhető” áll, ott nincs jelölt link, és még sosem azonosítottunk innen látogatást: ez nem 0, a valós szám a közvetlenben lehet. {SIGNUP_NOTE}</>} src={[...SOC, "gsc"]}>
        <TRows name="platform-ut" rows={pfRows.map((r) => ({ ...r, name: PF[r.k] || ch(r.k) }))} cols={[
          ...(phone ? [{ k: "logo", l: "", r: (r: D) => <Logo k={r.k} size={40} /> }] : []),
          { k: "name", l: "Platform", ph: "name", r: (r) => (phone ? <b>{r.name}</b> : <span className="ix-tr-id"><Logo k={r.k} size={44} /><b>{r.name}</b></span>) },
          { k: "views", l: phone ? "Megt. / megj." : "Megtekintés / megjelenés", num: true, ph: "main", r: (r) => (r.views == null ? <span className="mut">–</span> : <>{big(r.views)}</>) },
          { k: "clicks", l: "Kattintás", num: true, r: (r) => (r.k !== "google" && !n(r.links) && !n(r.clicks) ? <span className="mut">nem mérhető</span> : <>{fmt(r.clicks)} {n(r.views) ? <small className="mut">{pct(n(r.clicks), n(r.views), 2)}</small> : null}</>) },
          { k: "sessions", l: "Látogatás", num: true, r: (r) => (notMeasured(r.k, r.sessions) ? <span className="mut">nem mérhető</span> : <b>{fmt(r.sessions)}</b>) }, { k: "organic", l: "ebből link nélkül", num: true, r: (r) => <span className="mut">{fmt(r.organic)}</span> },
          { k: "scored", l: "Előnézet", num: true, ph: "sub", r: (r) => <>{fmt(r.scored)} {pctCell(n(r.scored), n(r.sessions))}</> },
          { k: "signups", l: "Regisztráció", num: true, ph: "sub", r: (r) => <>{fmt(r.signups)} {pctCell(n(r.signups), n(r.sessions))}</> },
        ]} />
      </Card></PhMore>}

      <Card className="s12" icon={P.globe} title="Csatornák: a teljes út" right={cb.ctl} sub={<>{cb.own ? <>Ennek a blokknak a saját időszaka: {periodWords(cb.p)}. </> : null}Honnan jött, eljutott-e az előnézetig, megnézte-e 50 év múlva, megosztott-e, és hány regisztrációt hozott (becslés). Mellette a változás az előző ugyanilyen hosszú időszakhoz. Kattints egy sorra: a csatorna saját oldala. {SIGNUP_NOTE}</>}>
        {cb.own && !cb.q.d ? <div className="skel" style={{ height: 200 }} /> : <TRows name="csatornak" rows={cChans.map((c) => { const sp = cb.own ? [] : ((d.channel_trend || []) as D[]).filter((x) => x.k === c.k).map((x) => n(x.n)); /* to sort and export: the last measured day against the first */ return { ...c, name: ch(c.k), tr: sp.length > 1 ? sp[sp.length - 1] - sp[0] : null }; })} onRow={(r) => setOpen(r.k)} cols={[
          ...(phone ? [{ k: "logo", l: "", r: (r: D) => <Logo k={r.k} size={40} /> }] : []),
          { k: "name", l: "Csatorna", ph: "name", r: (r) => (phone ? <span><b>{r.name}</b>{r.k === "ai" && <AiSites d={d} />}</span> : <span className="ix-tr-id"><Logo k={r.k} size={44} /><span><b>{r.name}</b>{r.k === "ai" && <AiSites d={d} />}</span></span>) },
          { k: "sessions", l: "Látogatás", num: true, ph: "main", r: (r) => (phone ? fmt(r.sessions) : <><b className="ix-tr-big">{fmt(r.sessions)}</b> {r.p_sessions != null && <Delta now={n(r.sessions)} prev={n(r.p_sessions)} />}{barCell(n(r.sessions), cMax, " ")}</>) },
          { k: "engaged", l: "Aktív", num: true, r: (r) => (r.engaged == null ? "–" : fmt(r.engaged)) },
          { k: "tr", l: "Trend", ph: "hide", r: (r) => { if (cb.own) return <span className="mut" title="A trend a fölső időszakot mutatja">–</span>; const sp = (d.channel_trend || []).filter((x: D) => x.k === r.k).map((x: D) => n(x.n)); return sp.length > 1 ? <span style={{ display: "inline-block", width: 90 }}><Spark values={sp} h={24} color={chCol(r.k)} /></span> : <span className="mut">–</span>; } },
          { k: "app", l: "App", num: true, r: (r) => <>{fmt(r.app)} {pctCell(n(r.app), n(r.sessions))}</> },
          { k: "scored", l: "Előnézet", num: true, ph: "sub", r: (r) => <>{fmt(r.scored)} {pctCell(n(r.scored), n(r.sessions))}</> },
          { k: "revealed", l: "50 év múlva", num: true, r: (r) => <>{fmt(r.revealed)} {pctCell(n(r.revealed), n(r.sessions))}</> },
          { k: "saved", l: "Mentett", num: true, r: (r) => (r.saved == null ? "–" : fmt(r.saved)) },
          { k: "shared", l: "Megosztott", num: true, r: (r) => <>{fmt(r.shared)} {pctCell(n(r.shared), n(r.sessions))}</> },
          { k: "signups", l: "Regisztráció (becslés)", num: true, ph: "sub", r: (r) => <>{fmt(r.signups)}{n(r.signups) > n(r.sessions) ? <span className="mut"> (becslés)</span> : null}{phone ? null : <> {r.p_signups != null && <Delta now={n(r.signups)} prev={n(r.p_signups)} />}{n(r.signups) ? <div className="mut" style={{ fontSize: 11 }}>{fmt(r.su_sure)} tudjuk · {fmt(r.su_good)} valószínű · {fmt(r.su_weak)} nem tudjuk</div> : null}</>}{!phone && n(r.signups) > n(r.sessions) ? <div className="mut" style={{ fontSize: 11 }}>Több, mint a látogatás, mert a párosítás becslés: a közeli látogatáshoz kötjük.</div> : null}</> },
          ...(phone ? [{ k: "su_sure", l: "Regisztráció bontása", r: (r: D) => <>{r.p_signups != null && <Delta now={n(r.signups)} prev={n(r.p_signups)} />} {fmt(r.su_sure)} tudjuk · {fmt(r.su_good)} valószínű · {fmt(r.su_weak)} nem tudjuk{n(r.signups) > n(r.sessions) ? <div className="mut">Több, mint a látogatás, mert a párosítás becslés: a közeli látogatáshoz kötjük.</div> : null}</> }] : []),
        ]} />}
      </Card>

      <Card className="s12" icon={P.target} title="Kampányok és videók (utm)" sub="A linkek utm_source / utm_campaign / utm_content jelölése szerint. A rövid linkek (inkage.app/go/12) ezt maguktól beállítják; ilyenkor a poszt címe is látszik.">
        <TRows name="kampanyok" rows={((T.campaigns || d.campaigns || []) as D[]).map((r) => ({ ...r, source_name: ch(r.source) }))} empty="Még senki nem jött jelölt linkről. Hozz létre egy rövid linket a Linkek oldalon, és tedd a videó leírásába." cols={[
          { k: "source_name", l: "Forrás", r: (r) => <span className="ix-tr-id"><Logo k={r.source} size={36} /><b>{r.source_name}</b></span> }, { k: "medium", l: "Típus" }, { k: "campaign", l: "Kampány" },
          { k: "content", l: "Videó / tartalom", r: (r) => <span className="cellwrap">{r.content}{r.post_title ? <><br /><span className="mut">{PF[r.post_platform] ? PF[r.post_platform] + ": " : ""}{String(r.post_title).slice(0, 60)}</span></> : null}</span> },
          { k: "sessions", l: "Látogatás", num: true, r: (r) => fmt(r.sessions) },
          { k: "scored", l: "Előnézet", num: true, r: (r) => <>{fmt(r.scored)} {pctCell(n(r.scored), n(r.sessions))}</> },
          { k: "revealed", l: "50 év múlva", num: true, r: (r) => <>{fmt(r.revealed)} {pctCell(n(r.revealed), n(r.sessions))}</> },
          { k: "shared", l: "Megosztott", num: true, r: (r) => fmt(r.shared) },
          { k: "signups", l: "Regisztráció", num: true, r: (r) => (r.signups == null ? "–" : fmt(r.signups)) },
        ]} />
      </Card>

      <More label="Részletek: hivatkozók, ref-kódok, belépő oldalak, napszak, a hét napjai, gombok, nyelv">
      <Card className="s4" icon={P.links} title="Hivatkozó oldalak" sub="Melyik oldalról kattintottak át."><ul className="refs">{referrers.slice(0, 8).map((r) => <li key={r.k}><Fav host={r.k} /><span>{r.k}</span><b>{fmt(r.n)}</b><small>{fmt(r.scored)} előnézet</small></li>)}{!referrers.length && <li className="note">Még nincs hivatkozó oldal.</li>}</ul></Card>
      <Card className="s4" icon={P.doc} title="Belépő oldal" sub="Az első oldal, amit láttak: az aktív látogatások."><BarList items={((T.landings || d.landings || []) as D[]).map((r: D) => ({ k: r.k, n: n(r.n), sub: `${fmt(r.scored)} előnézet${r.total != null && n(r.total) !== n(r.n) ? ` · és ${fmt(n(r.total) - n(r.n))} egyetlen megnyitás` : ""}` }))} /></Card>
      <Card className="s4" icon={P.eye} title="Legnézettebb oldalak" sub="Weboldal-megtekintések (cikkek is)."><BarList items={(d.pages || []).map((r: D) => ({ k: r.k === "start" ? "/app" : r.k || "/", n: n(r.n) }))} /></Card>

      <Card className="s8 napszak" icon={P.clock} title="Napszak" sub="Mikor kezdik az aktív látogatást (budapesti idő). Válassz egy órát." right={<span className="chip gold">Csúcs: {bestH.k}:00</span>}>
        <div className="clockrow"><HourClock hours={hours.map((x) => ({ h: Number(x.k), n: x.v }))} /><div style={{ flex: 1, minWidth: 0 }}><Columns data={hours} hiK={bestH.k} height={200} /></div></div>
      </Card>
      <Card className="s4" icon={P.bolt} title="Gombok a weboldalon" sub="Melyik gombot nyomják meg: az /app, a főoldal, a tudástár és a cikkek gombjai (az Android-app nyitóoldalával együtt).">
        <BarList items={(d.ctas || []).map((r: D) => ({ k: r.k, n: n(r.n) }))} fmtK={(k) => CTAK[k] || k} empty="Még nincs kattintás." />
      </Card>
      <Card className="s4" icon={P.calendar} title="A hét napjai" sub="Melyik napon kezdik az aktív látogatást."><Columns data={wk} height={170} hiK={[...wk].sort((a, b) => b.v - a.v)[0]?.k} /></Card>
      <Card className="s4" icon={P.links} title="Ajánló kódok (?ref=)" sub="A ?ref= paraméterrel érkezők (pl. bio-link, partner)."><BarList items={(d.refs || []).map((r: D) => ({ k: r.k, n: n(r.n), sub: `${fmt(r.scored)} előnézet` }))} empty="Még senki nem jött ?ref= jelöléssel." /></Card>
      <Card className="s4" icon={P.globe} title="Nyelv" sub="Az oldal nyelve a látogatásoknál, nem az ország. Kattints: szűrő erre a nyelvre."><BarList items={(d.langs || []).map((r: D) => ({ k: r.k, n: n(r.n), sub: `${fmt(r.scored)} előnézet` }))} fmtK={lang} max={10} onPick={(k) => set({ lang: k })} /></Card>
      <Card className="s12" icon={P.alert} title="Amit nem mérünk" sub="Szándékosan, az adatvédelem és az áruházi adatlapok miatt.">
        <p className="note">Az eszköz típusát (telefon / számítógép) a mérés nem küldi, ezért ez a kártya nem jelenik meg. Az alkalmazáson belüli böngészőt (TikTok, Instagram, Facebook) a weboldal okt. 22. óta elküldi: a csatornáknál ez is segít a forrást eltalálni. Az alkalmazáson belüli böngésző a TikTok, az Instagram és a Facebook esetén ismerhető fel, más appnál és a telefon saját böngészőjénél a forrás gyakran elvész: ezek a közvetlenben vannak. Az Android-app a Kapcsolatok oldalon bekapcsolható bővebb mérés nélkül a platformját és a regisztrációt sem küldi, és nem látszik, honnan jött aki telepítette. Az iPhone-app nem küld adatot.</p>
      </Card>
      </More>
      {open && <ChannelDrawer k={open} d={d} close={() => setOpen(null)} filter={() => { set({ ch: open }); setOpen(null); }} />}
    </div>
  );
}

/* ---------- the sources in one row: channel, visits, accounts, signatures, payers, and how sure the match is ---------- */
function SourceRank({ d, chans, onPick }: { d: D; chans: D[]; onPick: (k: string) => void }) {
  const { f } = useFlt();
  const q = useRpc("admin_sources_rank", { ...per(d), p_lang: f.lang || null }, [d.days, d.from, f.lang]);
  const pay = paymentsOn(false) || paymentsOn(true);
  const rows = ((Array.isArray(q.d) ? q.d : []) as D[]).filter((r) => !f.ch || f.ch.split(",").includes(r.k));
  const vis = new Map(chans.map((c) => [c.k, n(c.sessions)])), was = new Map(chans.map((c) => [c.k, c.p_sessions]));
  const conf = (r: D) => (r.k === "ismeretlen" ? ["nem tudjuk, honnan jöttek", "warn"] : n(r.sure) === n(r.accounts) ? ["tudjuk, honnan jöttek", "good"] : n(r.weak) > n(r.sure) + n(r.good) ? ["többnyire nem tudjuk", "warn"] : ["valószínűleg innen", ""]);
  return (
    <Card eager className="s12" icon={P.target} title="Források rangsora" sub="Az időszak fiókjai a regisztrációhoz legközelebbi névtelen látogatás forrása szerint: ez becslés, soronként látszik, mennyire tudjuk. Az előnézet a fiók saját adata, minden eszközön. Az iPhone-app nem küld adatot, ezért az ottani fiókok az „Ismeretlen” sorban vagy a „nem tudjuk” számban vannak. Az Android-app eszköz, nem forrás.">
      {!q.d ? <div className="skel" style={{ height: 180 }} /> : !rows.length ? <Empty t="Ebben az időszakban nem volt regisztráció." /> : <>
        <div className="ix-rows">{rows.map((r) => { const [cl, tone] = conf(r); return (
          <IRow key={r.k} on={r.k === "ismeretlen" ? undefined : () => onPick(r.k)} ic={<Logo k={r.k} size={44} />} t={r.k === "ismeretlen" ? "Ismeretlen forrás" : ch(r.k)}
            s={<><span className={"chip " + tone}>{cl}</span>{r.k !== "ismeretlen" && <span className="ix-r-d">{fmt(vis.get(r.k))} látogatás{pay ? ` · ${fmt(r.payers)} fizető` : ""}{was.get(r.k) != null && <Delta now={n(vis.get(r.k))} prev={n(was.get(r.k))} />}</span>}{r.k !== "ismeretlen" && <span>{fmt(r.sure)} tudjuk · {fmt(r.good)} valószínű · {fmt(r.weak)} nem tudjuk</span>}{r.k === "ai" && <AiSites d={d} />}</>}
            v={`${fmt(r.accounts)} fiók`} vs={`${fmt(r.made_accounts)} előnézetet készített`} />); })}</div>
        {!pay && <p className="note">Fizető: nincs adat, mert a fizetés most nincs bekapcsolva.</p>}
      </>}
    </Card>
  );
}

/* ---------- what a post brought, where that can be measured at all: the short links and tagged links tied to a post ---------- */
function PostsBrought({ rows }: { rows: D[] }) {
  const list = rows.filter((r) => r.post_title).sort((a, b) => n(b.signups) - n(a.signups) || n(b.sessions) - n(a.sessions));
  const why = "Csak az a poszt mérhető, amelynek saját rövid vagy jelölt linkje van. Minden másnál a látogató a közvetlenbe kerül, ezért ott nem tudjuk megmondani, mennyit hozott.";
  return (
    <Card className="s12" icon={P.social} title="Ez a poszt ennyit hozott" sub={why} noData={!list.length ? "Nincs mérhető poszt ebben az időszakban: " + why.charAt(0).toLowerCase() + why.slice(1) : undefined}>
      <ul className="pp-post">{list.slice(0, 8).map((r, i) => <li key={i}><Logo k={r.post_platform || r.source} size={22} /><div><b>{String(r.post_title).slice(0, 70)}</b><small>{fmt(r.sessions)} látogatás → {fmt(r.scored)} előnézet → {r.signups == null ? "regisztráció: nincs adat" : `${fmt(r.signups)} regisztráció (becslés)`}</small></div></li>)}</ul>
    </Card>
  );
}

/* ---------- jumps in the visits, and what happened on that day: a coincidence shown as one, never claimed as the cause ---------- */
function Spikes({ d }: { d: D }) {
  const trend = (d.trend || []) as D[], from = trend[0]?.t || null;
  const q = useRpc("admin_posts_days", { p_from: from, p_to: null }, [from], !from);
  const day = (t: unknown) => bpDate(new Date(String(t)));
  const med = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
  const base = med(trend.map((x) => n(x.sessions)));
  const posts = (Array.isArray(q.d) ? q.d : []) as D[];
  const list = trend.filter((x) => base > 0 && n(x.sessions) >= 2 * base && n(x.sessions) >= 10).slice(-3).reverse().map((x) => {
    const ct = ((d.channel_trend || []) as D[]), rows = ct.filter((c) => day(c.t) === day(x.t)).map((c) => ({ k: c.k as string, n: n(c.n), up: n(c.n) - med(ct.filter((y) => y.k === c.k).map((y) => n(y.n))) })).sort((a, b) => b.up - a.up);
    const top = rows[0]?.up > 0 ? rows[0] : null, prev = new Date(Date.parse(day(x.t) + "T12:00:00Z") - 864e5).toISOString().slice(0, 10);
    const near = posts.filter((p) => [day(x.t), prev].includes(day(p.at))), own = near.filter((p) => p.platform === top?.k);
    return { x, top, post: (own.length ? own : near).sort((a, b) => n(b.views) - n(a.views))[0] as D | undefined, more: near.length };
  });
  const none = `Nem volt kiugró nap ebben az időszakban (a szokásos napi ${fmt(base)} látogatás kétszerese).`;
  return (
    <Card className="s12" icon={P.bolt} title="Kiugró napok" sub="Azok a napok, amikor a látogatás legalább a szokásos kétszerese volt, és ami aznap történt. Ez egybeesés, nem bizonyított ok." noData={trend.length && !list.length ? none : undefined}>
      <ul className="pp-post">{list.map(({ x, top, post, more }) => <li key={String(x.t)}><div><b>{new Date(String(x.t)).toLocaleDateString("hu-HU", { month: "short", day: "numeric", weekday: "short" })}: {fmt(n(x.sessions) / base, 1)}× a szokásos ({fmt(x.sessions)} látogatás)</b>
        <small>{top ? <>Főleg innen: {ch(top.k)} (+{fmt(top.up)}). </> : null}{post ? <>Aznap vagy előtte kiment {more > 1 ? `${fmt(more)} poszt, például` : "ez"}: {PF[post.platform] || post.platform}, „{String(post.title || "cím nélkül").slice(0, 50)}”.</> : "Aznap és előtte nem ment ki poszt."}</small></div></li>)}</ul>
    </Card>
  );
}

/* the channel cards with the change against the period before */
const ALLCH = ["google", "tiktok", "instagram", "facebook", "pinterest", "linkedin", "youtube", "ai", "email"];
function ChCards({ chans, trend, onPick, notMeasured, only }: { chans: D[]; trend: D[]; onPick: (k: string) => void; notMeasured: (k: string, sessions: unknown) => boolean; only: string[] | null }) {
  const tot = chans.reduce((s, c) => s + n(c.sessions), 0) || 1;
  const have = new Map(chans.map((c) => [c.k, c]));
  /* the best source (most visits with a known source) leads, on the white card */
  const best = [...chans].filter((c) => !NOSRC.has(c.k) && n(c.sessions) > 0).sort((a, b) => n(b.sessions) - n(a.sessions))[0];
  /* the channels that brought someone, then the visits without a source, then the ones that brought nobody yet */
  const list: D[] = [...(best ? [best] : []), ...chans.filter((c) => !NOSRC.has(c.k) && n(c.sessions) > 0 && c !== best), ...(have.get("visszatérő") ? [have.get("visszatérő") as D] : []), ...(have.get("androidapp") ? [have.get("androidapp") as D] : []), ...(have.get("közvetlen") ? [have.get("közvetlen") as D] : []), ...ALLCH.filter((k) => !n(have.get(k)?.sessions) && (!only || only.includes(k))).map((k) => ({ k, sessions: 0, scored: 0, p_sessions: have.get(k)?.p_sessions }))];
  return (
    <div className="ix-swipe ix-chs">
      {list.map((c) => {
        const sp = trend.filter((x) => x.k === c.k).map((x) => n(x.n)), zero = !n(c.sessions), unm = zero && notMeasured(c.k, c.sessions);
        return (
          <button key={c.k} type="button" className={"ix-ch" + (zero ? " zero" : "") + (c === best ? " best ink-flip" : "")} onClick={!zero ? () => onPick(c.k) : undefined}>
            {c === best && <span className="ix-ch-top">A legjobb forrás</span>}
            <span className="ix-ch-h"><Logo k={c.k} size={c === best ? 104 : 72} /><em>{zero ? "–" : pct(n(c.sessions), tot)}</em></span>
            <b className="ix-ch-n">{ch(c.k)}</b>
            {unm ? <span className="ix-ch-v sm">nem mérhető</span> : <span className="ix-ch-v"><CountUp v={n(c.sessions)} /></span>}
            <span className="ix-ch-d">{!unm && <small>látogatás</small>}{c.p_sessions != null && (n(c.sessions) || n(c.p_sessions)) ? <Delta now={n(c.sessions)} prev={n(c.p_sessions)} /> : null}</span>
            <small className="ix-ch-c">{unm ? <>Nincs jelölt link.<Info>Ez nem 0: a valós szám a közvetlenben lehet.</Info></> : zero ? (n(c.p_sessions) ? `Előtte ${fmt(c.p_sessions)} látogatás` : "Még nem jött innen látogató") : `${pct(n(c.scored), n(c.sessions))} az előnézetig${n(c.signups) ? ` · ${fmt(c.signups)} regisztráció (becslés)` : ""}${n(c.doors) ? ` · ${fmt(c.doors)} egyetlen megnyitás` : ""}${c.k === "androidapp" ? " · eszköz, nem forrás" : ""}`}</small>
            {sp.length > 1 && !zero && <span className="ix-ch-sp"><Spark values={sp} h={34} color="var(--a-fg)" /></span>}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Sankey: channel → app → skin photo or skip → preview → 50 years on → shared ---------- */
export function SankeyFlow({ chans }: { chans: D[] }) {
  const top = [...chans].sort((a, b) => n(b.sessions) - n(a.sessions)).slice(0, 6);
  const rest = chans.filter((c) => !top.includes(c));
  const sum = (k: string, xs: D[]) => xs.reduce((s, c) => s + n(c[k]), 0);
  const groups = rest.length ? [...top, { k: "egyeb", ...Object.fromEntries(["sessions", "app", "captured", "skipped", "scored", "revealed", "shared"].map((k) => [k, sum(k, rest)])) }] : top;
  if (!groups.length || !groups.some((c) => n(c.sessions))) return <Empty t="Még nincs elég látogatás a folyamhoz." ghost />;
  const app = sum("app", groups), skipped = sum("skipped", groups), captured = groups.some((c) => c.captured != null) ? sum("captured", groups) : Math.max(0, app - skipped);
  const scored = sum("scored", groups), rev = sum("revealed", groups), shared = sum("shared", groups);
  const col = (k: string) => (k === "egyeb" ? "var(--ser-o)" : chCol(k));
  /* revealed: the ones who got a preview and the skippers who went through the intro questions */
  const revScored = Math.min(rev, scored), revSkip = Math.max(0, Math.min(skipped, rev - revScored));
  const layers = [
    groups.map((c) => ({ id: "c:" + c.k, l: c.k === "egyeb" ? "Egyéb" : ch(c.k), color: col(c.k) })),
    [{ id: "app", l: "Megnyitotta az appot", color: "var(--ser-2)" }, { id: "web", l: "Csak a weboldal", color: "var(--a-s4)" }],
    [{ id: "cap", l: "Feltöltött egy bőrfotót", color: "var(--ser-2)" }, { id: "skip", l: "Kihagyta a bőrfotót", color: "var(--ser-4)" }, { id: "drop0", l: "Nem jutott el a bőrfotóig", color: "var(--a-s4)" }],
    [{ id: "score", l: "Előnézetet kapott", color: ACC }, { id: "drop1", l: "Kiesett", color: "var(--a-s4)" }],
    [{ id: "rev", l: "Megnézte 50 év múlva", color: ACC }, { id: "drop2", l: "Kiesett a kérdéseknél", color: "var(--a-s4)" }],
    [{ id: "shr", l: "Megosztotta", color: ACC }, { id: "noshr", l: "Nem osztotta meg", color: "var(--a-s4)" }],
  ];
  const links = [
    ...groups.flatMap((c) => [{ a: "c:" + c.k, b: "app", v: n(c.app), color: col(c.k) }, { a: "c:" + c.k, b: "web", v: Math.max(0, n(c.sessions) - n(c.app)), color: col(c.k) }]),
    { a: "app", b: "cap", v: Math.min(captured, app), color: ACC }, { a: "app", b: "skip", v: Math.min(skipped, app) }, { a: "app", b: "drop0", v: Math.max(0, app - captured - skipped) },
    { a: "cap", b: "score", v: Math.min(scored, captured), color: ACC }, { a: "cap", b: "drop1", v: Math.max(0, captured - scored) },
    { a: "score", b: "rev", v: revScored, color: ACC }, { a: "score", b: "drop2", v: Math.max(0, scored - revScored) }, { a: "skip", b: "rev", v: revSkip }, { a: "skip", b: "drop2", v: Math.max(0, skipped - revSkip) },
    { a: "rev", b: "shr", v: Math.min(shared, rev), color: ACC }, { a: "rev", b: "noshr", v: Math.max(0, rev - shared) },
  ];
  return <Sankey layers={layers} links={links} height={Math.max(280, groups.length * 46)} />;
}

/* the site's own small icon next to a referrer (from Google's favicon service) */
export const Fav = ({ host }: { host: string }) => /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(host || "") ? <img className="fav" src={`https://www.google.com/s2/favicons?sz=32&domain=${encodeURIComponent(host)}`} alt="" width={16} height={16} referrerPolicy="no-referrer" loading="lazy" /> : <span className="fav" />;

/* ---------- one channel's own page: days, campaigns on a timeline, referrers, landing pages, languages, its posts ---------- */
function ChannelDrawer({ k, d, close, filter }: { k: string; d: D; close: () => void; filter: () => void }) {
  const sb = useMemo(() => supabaseBrowser(), []);
  const { f } = useFlt();
  const [x, setX] = useState<D | null>(null);
  /* the channel's own range: the page's until a pill is picked. 0 is every day there is */
  const [rg, setRg] = useState<number | null>(null);
  useEffect(() => { let live = true; rpc(sb, "admin_channel_detail", { p_ch: k, ...(rg == null ? per(d) : { p_days: rg, p_from: null, p_to: null }), p_lang: f.lang || null }).then(({ data }) => { if (live) setX(data || {}); }); return () => { live = false; }; }, [sb, k, d, f.lang, rg]);
  const rgName = rg == null ? periodName(d) : rg === 7 ? "az elmúlt héten" : rg === 30 ? "az elmúlt hónapban" : "a kezdetek óta";
  const t: D = x?.totals || {}, pv: D = x?.prev || {}, camps: D[] = x?.campaigns || [];
  const t0 = camps.length ? Math.min(...camps.map((c) => new Date(c.first).getTime())) : 0, t1 = camps.length ? Math.max(...camps.map((c) => new Date(c.last).getTime()), t0 + 864e5) : 1;
  return (
    <Layer>
      <div className="scrim" onClick={close} />
      <aside className="drawer wide" role="dialog" aria-label={ch(k)}>
        <div className="c-h"><div><span className="eyebrow">Csatorna</span></div><CloseX close={close} /></div>
        <div className="ix-chd"><Logo k={k} size={88} /><h2>{ch(k)}</h2>
          <div className="adm-seg sm" role="group" aria-label="Időszak">{([[null, "Mint fölül"], [7, "Hét"], [30, "Hónap"], [0, "Összes"]] as [number | null, string][]).map(([v, l]) => <button key={l} type="button" aria-pressed={rg === v} onClick={() => { if (rg !== v) { setX(null); setRg(v); } }}>{l}</button>)}</div></div>
        {!x ? <div className="skel" style={{ height: 240 }} /> : <>
          <div className="ix-chd-n"><span>Látogatás {rgName}</span><Giant v={n(t.sessions)} max={120} /><small className="ix-chd-s"><Delta now={n(t.sessions)} prev={n(pv.sessions)} />{t.engaged != null ? <> {fmt(t.engaged)} aktív</> : null}</small></div>
          <div className="mini-stats" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
            <Mini l="Előnézet" v={fmt(t.scored)} sub={<>{pct(n(t.scored), n(t.sessions))} · <Delta now={n(t.scored)} prev={n(pv.scored)} /></>} />
            <Mini l="50 év múlva" v={fmt(t.revealed)} sub={pct(n(t.revealed), n(t.sessions))} />
            <Mini l="Regisztráció" v={fmt(t.signups)} sub={<>becslés{t.su_sure != null ? <>: {fmt(t.su_sure)} tudjuk, {fmt(t.su_good)} valószínű, {fmt(t.su_weak)} nem tudjuk</> : null} · <Delta now={n(t.signups)} prev={n(pv.signups)} /></>} />
          </div>
          <h3>Naponta</h3>
          {(x.days || []).length > 1 ? <TrendChart data={(x.days as D[]).map((y) => ({ t: y.t, v: n(y.sessions), p: n(y.scored) }))} label="Látogatás" prevLabel="Előnézet" height={170} color={chCol(k)} /> : <Empty t="Kevés adat." />}
          <Tbl name={"csatorna-" + k + "-naponta"} rows={((x.days || []) as D[]).filter((y) => n(y.sessions) || n(y.signups)).map((y) => ({ ...y, t: String(y.t).slice(0, 10) }))} empty="Nincs nap látogatással." cols={[
            { k: "t", l: "Nap" }, { k: "sessions", l: "Látogatás", num: true }, { k: "scored", l: "Előnézet", num: true, r: (r) => <>{fmt(r.scored)} {pctCell(n(r.scored), n(r.sessions))}</> }, { k: "signups", l: "Regisztráció", num: true }]} />
          <h3>Kampányok és rövid linkek az időben</h3>
          {camps.length ? <ul className="ctl">{camps.map((c) => { const a = new Date(c.first).getTime(), b = new Date(c.last).getTime();
            return <li key={c.k}><span className="ctl-k">{c.k}</span><span className="ctl-bar"><i style={{ left: `${((a - t0) / (t1 - t0)) * 100}%`, width: `${Math.max(2, ((b - a) / (t1 - t0)) * 100)}%`, background: chCol(k) }} /></span><b>{fmt(c.n)}</b><small>{fmt(c.scored)} előnézet · {fmt(c.signups)} regisztráció · {ago(c.last)}</small></li>; })}</ul> : <Empty t="Ebből a csatornából nem jött jelölt link." />}
          {(x.posts || []).length > 0 && <><h3>A csatorna posztjai</h3>
            <Tbl name={"csatorna-" + k + "-posztok"} rows={x.posts} cols={[
              { k: "title", l: "Poszt", r: (r) => <a className="cellwrap" href={r.url || undefined} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>{String(r.title || "(cím nélkül)").slice(0, 70)}</a> },
              { k: "created_at", l: "Megjelent", r: (r) => ago(r.created_at) }, { k: "views", l: "Megtekintés (összes)", num: true, r: (r) => big(r.views) },
              { k: "code", l: "Rövid link", r: (r) => (r.code ? <b>/go/{r.code}</b> : <span className="mut">nincs</span>) },
              { k: "sessions", l: "Látogatás", num: true }, { k: "scored", l: "Előnézet", num: true },
            ]} /></>}
          <h3>Hivatkozó oldalak</h3>
          <ul className="refs">{((x.referrers || []) as D[]).map((r) => <li key={r.k}><Fav host={r.k} /><span>{r.k}</span><b>{fmt(r.n)}</b><small>{fmt(r.scored)} előnézet</small></li>)}{!(x.referrers || []).length && <li className="note">Nincs hivatkozó (appból vagy közvetlenül jöttek).</li>}</ul>
          <h3>Belépő oldalak</h3><BarList items={((x.landing || []) as D[]).map((r) => ({ k: r.k, n: n(r.n), sub: `${fmt(r.scored)} előnézet · ${fmt(r.signups)} regisztráció` }))} />
          <h3>Nyelvek</h3><BarList items={((x.langs || []) as D[]).map((r) => ({ k: r.k, n: n(r.n), sub: `${pct(n(r.scored), n(r.n))} előnézetig · ${fmt(r.signups)} regisztráció` }))} fmtK={lang} />
          <button className="adm-ibtn gold" onClick={filter}>Szűrő erre a csatornára</button>
          <p className="note">A szűrő az időszakot és a csatornát követő oldalakra hat (Áttekintés, Források, Tölcsér, Használat, Megtartás).</p>
        </>}
      </aside>
    </Layer>
  );
}
