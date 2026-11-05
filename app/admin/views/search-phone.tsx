"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
/* Google on the phone: not Search Console's tables but what changed, what to do about it and the daily routine.
   Every number is Google's exact total unless the line says it comes from the visible searches only. */
import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Delta, Empty, Info, TrendChart, compact, fmt, pct } from "../charts";
import { ChartBox } from "../extra";
import { Sheet, SubTabs, haptic, pushRecent, toast } from "../phone";
import { Card, Mini, P, Async, ago, lang, n, posChip, rpc, short, type D, useRpc } from "../shared";
import { Chg, Hero, Ring, Trio } from "../ink";
import { BigPos, Curve, Pills, Stripe, dayTol } from "./reach-ink";
import { Ranks, SeoDrawer } from "./search";

const sbNew = () => supabaseBrowser();
const dShort = (x?: string | null) => (x ? new Date(String(x).slice(0, 10) + "T12:00:00").toLocaleDateString("hu-HU", { month: "short", day: "numeric" }) : "–");
/* "okt. 7-től": the ending follows the day's last sound */
const dFrom = (x?: string | null) => (x ? dayTol(String(x).slice(0, 10)) : "–");
const dPlain = (x?: string | null) => dShort(x).replace(/\.$/, "");
const days = (t?: string | null) => (t ? Math.max(0, Math.floor((Date.now() - new Date(t).getTime()) / 864e5)) : 0);

/* Where a request is made. The inspection's own link holds an id of Google's (one built from the address is a 404), it comes
   with each morning check; until then Search Console opens and the copied address goes into its search field. */
export const inspectUrl = (link?: string | null) => link || `https://search.google.com/search-console?resource_id=${encodeURIComponent("sc-domain:inkage.app")}`;
const copyUrl = (u: string) => { try { navigator.clipboard?.writeText(u); toast("Cím kimásolva"); } catch { /* the page still opens */ } };

/* Google's states in plain Hungarian, each with what to do; the old checks stored them in Hungarian, the new in English */
export function covPlain(c?: string | null, verdict?: string | null): { l: string; tone: "good" | "warn" | "bad" | ""; step: string; req?: boolean } {
  const s = String(c || "");
  if (/Alternate page|Alternatív oldal/.test(s)) return { l: "Másik nyelvi változat, így rendben", tone: "good", step: "Nincs teendő." };
  if (verdict === "PASS" || /indexed, not|Submitted and indexed|Beküldött és indexelt/i.test(s)) return { l: "A Google megtalálja", tone: "good", step: "Nincs teendő." };
  if (/unknown to Google|nem ismeri/i.test(s)) return { l: "A Google még nem tud róla", tone: "warn", step: "Kérd az indexelést.", req: true };
  if (/Discovered|Felfedezve/i.test(s)) return { l: "Tud róla, de még nem olvasta el", tone: "warn", step: "Kérd az indexelést.", req: true };
  if (/Crawled|Feltérképezve/i.test(s)) return { l: "Elolvasta, de nem vette fel a találatok közé", tone: "warn", step: "Tegyél rá linket egy rokon cikkből, aztán kérd újra.", req: true };
  if (/Duplicate|Párhuzamos/i.test(s)) return { l: "Másolatnak tartja", tone: "warn", step: "Kérés nem segít: az oldalnak meg kell mondania, melyik a fő változat." };
  if (/noindex/i.test(s)) return { l: "Az oldal kéri, hogy ne vegye fel", tone: "bad", step: "Kérés nem segít: az oldal beállítását kell átírni." };
  if (/redirect/i.test(s)) return { l: "Átirányít máshová", tone: "", step: "Általában rendben, a céloldalt nézd." };
  if (/404/.test(s)) return { l: "Nem található", tone: "bad", step: "Javítsd a címet, vagy vedd ki az oldaltérképből." };
  return s ? { l: s, tone: "", step: "" } : { l: "Még nem ellenőriztük", tone: "", step: "Néhány napon belül sorra kerül." };
}

/* ---------- the page ---------- */
const TABS = [{ k: "news", l: "Hírek" }, { k: "index", l: "Indexelés" }, { k: "near", l: "Lehetőségek" }, { k: "keys", l: "Kulcsszavak" }, { k: "todo", l: "Teendők" }, { k: "all", l: "Minden adat" }];
export function SearchPhone({ days: period, full }: { days: number; full: React.ReactNode }) {
  const [tab, setTabS] = useState(() => { try { return sessionStorage.getItem("inkage.admin.gtab") || "news"; } catch { return "news"; } });
  const setTab = (k: string) => { setTabS(k); try { sessionStorage.setItem("inkage.admin.gtab", k); } catch {} };
  const [pg, setPg] = useState<string | null>(null);
  return (
    <div className={"gp" + (tab === "news" || tab === "index" || tab === "todo" ? " ir-nohead" : "")}>
      <SubTabs items={TABS} cur={tab} go={setTab} />
      {tab === "news" && <News open={setPg} go={setTab} />}
      {tab === "index" && <IndexRoutine open={setPg} />}
      {tab === "near" && <Chances days={period} open={setPg} />}
      {tab === "keys" && <Keywords days={period} open={setPg} />}
      {tab === "todo" && <SeoTasksLoad open={setPg} />}
      {tab === "all" && full}
      {pg && <GooglePageSheet page={pg} days={Math.max(28, Math.min(period || 28, 365))} close={() => setPg(null)} />}
    </div>
  );
}

/* ---------- the news: one line per kind of change, its pages behind a tap, one next step ---------- */
const EV_P: Record<string, { t: (x: number) => string; tone: string; step: string }> = {
  first_in: { t: (x) => `${x} oldal felment az első oldalra`, tone: "good", step: "Ne írd át most a címüket: hagyd erősödni, és tegyél rájuk linket a rokon cikkekből." },
  first_out: { t: (x) => `${x} oldal lecsúszott az első oldalról`, tone: "warn", step: "Nyisd meg az adatlapját: linkelj rá egy rokon cikkből, és nézd meg, melyik keresésre esett vissza." },
  gone: { t: (x) => `${x} oldal eltűnt a találatokból`, tone: "bad", step: "Nyisd meg az adatlapját: ha már nincs bent a Google-ben, kérd újra az indexelését." },
  up: { t: (x) => `${x} oldal többet hoz, mint előtte`, tone: "good", step: "Nézd meg, melyik keresés hozza: abból lehet következő cikk." },
  down: { t: (x) => `${x} oldal kevesebbet hoz, mint előtte`, tone: "warn", step: "Nyisd meg az adatlapját: a helyezése vagy a megjelenése esett?" },
  new: { t: (x) => `${x} oldal először jelent meg a Google-ben`, tone: "info", step: "Itt még várni kell: két hét múlva nézd meg, melyik hoz kattintást." },
};
const EV_Q: Record<string, { t: (x: number) => string; tone: string; step: string }> = {
  first_in: { t: (x) => `${x} keresésnél az első oldalra kerültél`, tone: "good", step: "Csillagozd a Kulcsszavak fülön, hogy lásd, megmarad-e." },
  first_out: { t: (x) => `${x} keresésnél lecsúsztál az első oldalról`, tone: "warn", step: "Írd bele a keresést a cikk egyik alcímébe." },
  up: { t: (x) => `${x} keresésnél legalább 3 helyet javultál`, tone: "good", step: "Csillagozd a Kulcsszavak fülön, hogy lásd, megmarad-e." },
  down: { t: (x) => `${x} keresésnél legalább 3 helyet romlottál`, tone: "warn", step: "Nézd meg a cikket: a keresés szó szerint szerepel benne?" },
  new: { t: (x) => `${x} új keresésnél jelentél meg`, tone: "info", step: "Ami illik egy cikkhez, abból legyen alcím; ami nem, abból új cikk lehet." },
};
const change = (r: D) => {
  if (n(r.prev_impressions) && n(r.pos) > 0 && r.prev_pos != null && Math.abs(n(r.prev_pos) - n(r.pos)) >= 0.5) return `${fmt(n(r.prev_pos), 1)}. helyről ${fmt(n(r.pos), 1)}. helyre`;
  return n(r.pos) > 0 ? `${fmt(n(r.pos), 1)}. hely` : "már nem jelenik meg";
};

const TONE_I: Record<string, string> = { good: "↑", warn: "↓", bad: "!", info: "✦" };
function NewsItem({ tone, t, step, children, note }: { tone: string; t: string; step: string; children: React.ReactNode; note?: string }) {
  const [o, setO] = useState(false);
  return (
    <article className={"ir-fc t-" + tone}>
      <span className="ir-fc-i" aria-hidden="true">{TONE_I[tone] || "•"}</span>
      <div className="ir-fc-m"><b>{t}</b>
        <button type="button" className="ir-do" aria-expanded={o} onClick={() => setO(!o)}>{o ? "Bezárás" : "Mit tegyél"}</button></div>
      {o && <div className="ir-fc-x"><p>{step}</p>{note && <p className="note">{note}</p>}{children}</div>}
    </article>
  );
}
const Rows = ({ rows, open }: { rows: D[]; open: (u: string) => void }) => {
  const [all, setAll] = useState(false);
  return <>{(all ? rows : rows.slice(0, 8)).map((r) => (
    <button key={r.k + (r.page || "")} className="gn-r" onClick={() => open(r.page || r.k)}>
      <span className="gn-n">{r.page ? "„" + r.k + "”" : short(r.k) || "/"}</span>
      <small>{change(r)} · {fmt(r.impressions)} megjelenés · {fmt(r.clicks)} kattintás{n(r.prev_impressions) ? ` (előtte ${fmt(r.prev_impressions)} és ${fmt(r.prev_clicks)})` : ""}</small>
    </button>))}
    {rows.length > 8 && !all && <button className="lnk gn-more" onClick={() => setAll(true)}>Mind a {fmt(rows.length)}</button>}</>;
};
const planUpd = (t: string) => String(t).replace(/core update/i, "fő frissítés").replace(/spam update/i, "spamszűrő-frissítés").replace(/Discover update/i, "Discover-frissítés").replace(/site reputation abuse update/i, "oldalhírnév-frissítés");

/* the clicks of a stretch of days from Google's daily totals: the same source as Search Console */
const ymd = (x: number) => new Date(x).toISOString().slice(0, 10);
const noon = (x: string) => new Date(String(x).slice(0, 10) + "T12:00:00Z").getTime();
const RANGE = [[7, "Hét"], [30, "Hónap"], [365, "Év"]] as const;
function ClicksHero({ d }: { d: D }) {
  const [w, setW] = useState<7 | 30 | 365>(7); const [yr, setYr] = useState(false);
  const all: D[] = ((d.trend || []) as D[]).filter((x) => x.clicks != null), last = noon(d.last_day), first = String(d.data_from || all[0]?.t || "").slice(0, 10);
  const from = ymd(last - (w - 1) * 864e5), to = ymd(last);
  const inW = (a: string, b: string) => all.filter((x) => { const t = String(x.t).slice(0, 10); return t >= a && t <= b; });
  const rows = inW(from, to), clicks = rows.reduce((a, x) => a + n(x.clicks), 0), imps = rows.reduce((a, x) => a + n(x.impressions), 0);
  const posW = rows.reduce((a, x) => a + n(x.pos) * n(x.impressions), 0), pos = imps ? posW / imps : 0;
  /* the period before, or the same days a year earlier; only when Google's data reaches that far back */
  /* a year back only when Google's data reaches there: otherwise the switch cannot be on, and it says why */
  const yrOk = !!first && first <= ymd(noon(from) - 365 * 864e5), useYr = yr && yrOk;
  const back = useYr ? 365 : w, a0 = ymd(noon(from) - back * 864e5), b0 = ymd(noon(to) - back * 864e5), ok = !!first && first <= a0;
  const before = ok ? inW(a0, b0).reduce((a, x) => a + n(x.clicks), 0) : 0;
  const prelim = String(d.last_day).slice(0, 10) >= ymd(noon(new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" })) - 864e5);
  const cut = first > from;
  return <Hero flip label={<>Kattintás a Google-ből<Info>{dPlain(cut ? first : from)} – {dPlain(to)}{prelim ? ", az utolsó nap még változhat" : ""}. A Google 1–3 nap késéssel ad adatot; a szám a saját napi összesítőjéből jön. {ok ? (useYr ? "Összevetve az egy évvel korábbi ugyanilyen hosszú időszakkal." : "Összevetve az előtte lévő ugyanilyen hosszú időszakkal.") : `Összevetés nincs: a Google-adatunk ${dFrom(first)} van.`}</Info></>} v={clicks}
    chg={ok ? <Chg a={clicks} b={before} tail={useYr ? "egy éve" : "előtte"} /> : undefined} sub={cut ? `${dFrom(first)}, ennyi a mért idő` : `${dPlain(from)} – ${dPlain(to)}`}
    side={<div className="ir-side"><Curve values={rows.map((x) => n(x.clicks))} h={120} label="A kattintások napról napra" />
      <div className="ir-pillrow"><Pills items={RANGE} cur={w} pick={setW} label="Időszak" /><button type="button" className="ir-do" aria-pressed={useYr} disabled={!yrOk} onClick={() => setYr(!yr)}>Előző évvel</button></div>{!yrOk && <small className="ir-cap ir-cap-r">Egy éve még nem mértünk.</small>}
      <Trio items={[{ l: "megjelenés", v: compact(imps) }, { l: "kattintási arány", v: imps ? pct(clicks, imps) : "–" }, { l: "átlagos hely", v: pos ? fmt(pos, 1) + "." : "–" }]} /></div>} />;
}

/* the feed: one card per kind of change; "Mit tegyél" opens the step and the pages */
function FeedList({ d, open, go }: { d: D; open: (u: string) => void; go?: (k: string) => void }) {
  const pages: D[] = d.pages || [], qs: D[] = d.queries || [], ix = d.index || {}, t = d.totals || {};
  const of = (l: D[], e: string) => l.filter((x) => x.e === e);
  const cover = n(t.impressions) ? pct(n(d.cover?.rows_impressions), n(t.impressions)) : "–";
  const qNote = `A kereséseknél a Google csak a megjelenések ${cover}-ánál mutatja meg, mit írtak be, ezért ez nem a teljes kép.`;
  const inL: D[] = ix.in || [], outL: D[] = ix.out || [];
  const any = pages.length + qs.length + inL.length + outL.length > 0;
  const ixRows = (l: D[]) => l.slice(0, 12).map((x) => <button key={x.url + x.at} className="gn-r" onClick={() => open(x.url)}><span className="gn-n">{short(x.url) || "/"}</span><small>{covPlain(x.coverage).l} · {ago(x.at)}</small></button>);
  return <div className="ir-feed">
    {outL.length > 0 && <NewsItem tone="bad" t={`${outL.length} oldal kiesett a Google-ből`} step="Nyisd meg az adatlapját, és kérd újra az indexelését az Indexelés fülön.">{ixRows(outL)}</NewsItem>}
    {inL.length > 0 && <NewsItem tone="good" t={`${inL.length} új oldal került be a Google-be`} step="Nézd meg, melyik fontos neked, és linkelj rá egy rokon cikkből.">{ixRows(inL)}</NewsItem>}
    {(["gone", "first_out", "first_in", "up", "down", "new"] as const).map((e) => { const l = of(pages, e); return l.length ? <NewsItem key={"p" + e} tone={EV_P[e].tone} t={EV_P[e].t(l.length)} step={EV_P[e].step}><Rows rows={l} open={open} /></NewsItem> : null; })}
    {(["first_in", "first_out", "up", "down", "new"] as const).map((e) => { const l = of(qs, e); return l.length ? <NewsItem key={"q" + e} tone={EV_Q[e].tone} t={EV_Q[e].t(l.length)} step={EV_Q[e].step} note={qNote}><Rows rows={l} open={open} /></NewsItem> : null; })}
    {!any && <Empty t={`Ebben a ${d.days} napban nem volt olyan változás, amit érdemes jelezni. Csak az számít itt, aminek legalább pár megjelenése volt.`} icon={P.check} />}
    {!inL.length && !outL.length && <p className="note ir-idx">Indexelési változás: {dFrom(ix.log_from)} rögzítjük, eddig nem jött. A régebbi napokról nincs ilyen napló.{go && <> <button className="lnk" onClick={() => go("index")}>A napi kérések</button></>}</p>}
  </div>;
}
const WIN = [[7, "7 nap"], [14, "14 nap"]] as const;
const FeedHead = ({ win, setWin }: { win: 7 | 14; setWin: (x: 7 | 14) => void }) => <div className="ir-head"><h3 className="ink-h">Mi változott</h3><Pills items={WIN} cur={win} pick={setWin} label="Az időszak" /></div>;

/* the computer's page shows the same feed in the Google page's own grid */
export function GoogleFeedCard({ open }: { open: (u: string) => void }) {
  const [win, setWin] = useState<7 | 14>(7);
  const q = useRpc("admin_google_news", { p_days: win }, [win]);
  return <section className="s12 ir-feedwrap"><FeedHead win={win} setWin={setWin} /><Async q={q} h={200}>{(d) => (d.empty ? <Empty t="Még nincs letöltött Google-adat. Az első lehúzás után itt látod, mi változott." icon={P.search} /> : <FeedList d={d} open={open} />)}</Async></section>;
}

function News({ open, go }: { open: (u: string) => void; go: (k: string) => void }) {
  const [win, setWin] = useState<7 | 14>(7);
  const q = useRpc("admin_google_news", { p_days: win }, [win]);
  const [m, setM] = useState<"clicks" | "impressions" | "pos">("clicks");
  return <Async q={q} h={320}>{(d) => {
    if (d.empty) return <Empty t="Még nincs letöltött Google-adat. Az első lehúzás után itt látod, mi változott." icon={P.search} />;
    const marks = ((d.updates || []) as D[]).map((u) => ({ t: String(u.begin_at).slice(0, 10), label: "Google-frissítés: " + planUpd(u.title), color: "var(--a-mut)" }));
    const pos = (x: D) => (n(x.impressions) > 0 && n(x.pos) > 0 ? -n(x.pos) : undefined);
    const chart = ((d.trend || []) as D[]).map((x) => ({ t: x.t, v: m === "pos" ? pos(x) : n(x[m]) })).filter((x) => x.v != null) as { t: string; v: number }[];
    return <>
      <ClicksHero d={d} />
      <FeedHead win={win} setWin={setWin} />
      <FeedList d={d} open={open} go={go} />

      <Card eager className="s12" icon={P.traffic} title="Naponta" sub="Google saját napi összesítőjéből. A függőleges jel Google-frissítést mutat."
        right={<div className="adm-seg sm"><button aria-pressed={m === "clicks"} onClick={() => setM("clicks")}>Kattintás</button><button aria-pressed={m === "impressions"} onClick={() => setM("impressions")}>Megjelenés</button><button aria-pressed={m === "pos"} onClick={() => setM("pos")}>Hely</button></div>}>
        {chart.length > 1 ? <ChartBox data={chart} marks={marks} label={m === "clicks" ? "Kattintás" : m === "impressions" ? "Megjelenés" : "Hely (fent a jobb)"} name={"google-" + m} height={190} /> : <Empty t="Két mért nap után rajzolható." />}
      </Card>
      <Card className="s12" icon={P.calendar} title="Google-frissítések: ennek nyomán változott-e?" sub="A frissítés előtti és utáni 7 mért nap kattintása. Az egybeesés nem bizonyíték, csak nyom.">
        {(d.updates || []).length ? <ul className="gn-up">{(d.updates as D[]).map((u) => {
          const ok = n(u.before_days) >= 7 && n(u.after_days) >= 7;
          return <li key={u.id}><b>{planUpd(u.title)}</b><small>{dPlain(u.begin_at)}{u.end_at ? " – " + dPlain(u.end_at) : ", még tart"}</small>
            <span>{ok ? <>Kattintás 7 nap alatt: <b>{fmt(u.before_clicks)} → {fmt(u.after_clicks)}</b>, megjelenés: {fmt(u.before_impressions)} → {fmt(u.after_impressions)}</> : !u.end_at ? "Nem mérhető: még tart." : n(u.before_days) < 7 ? `Nem mérhető: előtte nincs 7 nap Google-adatunk (${dFrom(d.data_from)} mérünk).` : `Még nem mérhető: utána csak ${fmt(u.after_days)} nap adat van.`}</span></li>; })}</ul> : <Empty t="A Google frissítésnaplója még nem töltődött be." />}
      </Card>
    </>;
  }}</Async>;
}

/* ---------- the daily indexing routine ---------- */
const DAY_LIMIT = 10;
const INDEX_TICK = "inkage.admin.index-tick";
function IndexRoutine({ open }: { open: (u: string) => void }) {
  const sb = useMemo(sbNew, []);
  const q = useRpc("admin_index_queue", undefined, []);
  /* ticked ones leave the list at once, also when the answer is slow */
  const [gone, setGone] = useState<string[]>([]); const [all, setAll] = useState(false); const [reqAll, setReqAll] = useState(false);
  /* the page's own sheet ticks too: the row leaves here at once and the count follows */
  useEffect(() => { const f = (e: Event) => { const u = (e as CustomEvent<string>).detail; setGone((g) => (g.includes(u) ? g : [...g, u])); q.load(); }; addEventListener(INDEX_TICK, f); return () => removeEventListener(INDEX_TICK, f); }, [q.load]); // eslint-disable-line react-hooks/exhaustive-deps
  const tick = async (u: string) => { haptic(12); setGone((g) => [...g, u]); const { error } = await rpc(sb, "admin_index_request_set", { p_url: u, p_on: true }); if (error) { setGone((g) => g.filter((x) => x !== u)); toast("Nem sikerült menteni"); } else { toast("Kipipálva"); q.load(); } };
  const undo = async (u: string) => { const { error } = await rpc(sb, "admin_index_request_set", { p_url: u, p_on: false }); if (error) { toast("Nem sikerült visszavonni"); return; } setGone((g) => g.filter((x) => x !== u)); toast("Visszavonva"); q.load(); };
  return <Async q={q} h={320}>{(d) => {
    const rows: D[] = ((d.queue || []) as D[]).filter((x) => !gone.includes(x.url)), req: D[] = d.requested || [], ew: D[] = d.elsewhere || [];
    const today = n(d.today) + gone.filter((u) => !req.some((x) => x.url === u)).length;
    const STATE: Record<string, [string, string]> = { in: ["Bekerült", "good"], no: ["Még nincs bent", "warn"], wait: ["Még nem ellenőriztük újra", ""] };
    return <>
      <Hero flip label={<>Ma kért indexelés<Info>A Google a sima oldalakhoz nem ad nyilvános kérési lehetőséget, ezért a kérést nem tudja elküldeni ez az oldal. A gomb kimásolja a címet, és megnyitja a Search Console-t: ha van már közvetlen linkje, rögtön ennek az oldalnak a vizsgálatát, ha nincs, felül a nagyítóba illeszd be a címet. Ott nyomd meg az „Indexelési kérelem” gombot, aztán itt pipáld ki. A Google nagyjából napi {DAY_LIMIT} kérést enged.</Info></>} text={`${fmt(today)}/${DAY_LIMIT}`}
        sub={today >= DAY_LIMIT ? "Mára megvan, holnap folytasd." : "Másol és megnyit, kérd a Search Console-ban, aztán pipáld ki."}
        side={<div className="ir-side row"><span className="ir-sring"><Ring p={today / DAY_LIMIT} kind="seg" label="A mai kérések aránya a napi kerethez" /></span><Trio items={[{ l: "sorban vár", v: fmt(rows.length) }, { l: `rendben, összesen ${fmt(d.all)}`, v: fmt(d.ok) }, { l: "sosem ellenőrzött", v: fmt(n(d.never)) }]} /></div>} />
      <div className="ir-ready"><span className="ir-ready-l"><b>{fmt(today)}/{DAY_LIMIT}</b><small>a mai keret</small></span><Stripe a={today} of={DAY_LIMIT} cells={DAY_LIMIT} label={`${fmt(today)} kérés a napi ${DAY_LIMIT}-ből`} />
        {n(d.all) > 0 && <><span className="ir-ready-l"><b>{fmt(d.ok)}/{fmt(d.all)}</b><small>rendben az ellenőrzöttekből</small></span><Stripe a={n(d.ok)} of={n(d.all)} cells={40} label={`${fmt(d.ok)} rendben ${fmt(d.all)} ellenőrzött címből`} /></>}</div>
      {n(d.never) > 0 && <p className="note ir-idx">Naponta kb. {fmt(d.per_day)} cím kerül sorra; a még nem ellenőrzöttek nincsenek ebben a sorban.</p>}
      {rows.length ? <ul className="ir-tick">{(all ? rows : rows.slice(0, DAY_LIMIT)).map((r) => { const c = covPlain(r.coverage, r.verdict); return (
        <li key={r.url}>
          <button type="button" className="ir-ck" aria-label={`Kértem: ${short(r.url) || "/"}`} title="Kértem" onClick={() => tick(r.url)} />
          <button type="button" className="ir-tick-u" onClick={() => open(r.url)}><b>{short(r.url) || "/"}</b><small>{lang(r.lang)} · {c.l}{r.times ? ` · ${r.times}. kérés lenne` : ""}</small></button>
          <a className="ir-do" href={inspectUrl(r.link)} target="_blank" rel="noreferrer" onClick={() => copyUrl(r.url)}>Másol és megnyit</a>
        </li>); })}</ul> : <Empty t="Nincs várakozó cím. Az újonnan ellenőrzöttek reggel kerülnek ide." icon={P.check} />}
      {rows.length > DAY_LIMIT && !all && <button className="more-b gn-more2" onClick={() => setAll(true)}>Mind a {fmt(rows.length)} (angol és magyar elöl)</button>}

      {req.length > 0 && <Card eager className="s12" icon={P.check} title={`Kérted az elmúlt 30 napban (${fmt(req.length)})`} sub="Egy kérés nem ígéret: a Google dönti el, felveszi-e. Két nappal a kérés után újra megnézzük a címet; 14 nap után, ha még nincs bent, visszakerül a sorba.">
        <ul className="ir-tick done">{(reqAll ? req : req.slice(0, 8)).map((r) => { const s = STATE[r.state] || STATE.wait; return (
          <li key={r.url}><span className="ir-ck on" aria-hidden="true">✓</span><button type="button" className="ir-tick-u" onClick={() => open(r.url)}><b>{short(r.url) || "/"}</b><small>{days(r.at) ? `${days(r.at)} napja kérted` : "ma kérted"}{r.state === "no" ? ` · ${covPlain(r.coverage).l}` : ""}</small></button>
            <span className="ir-tick-s"><span className={"chip " + s[1]}>{s[0]}</span>{days(r.at) === 0 && <button className="lnk" onClick={() => undo(r.url)}>vissza</button>}</span></li>); })}</ul>
        {req.length > 8 && !reqAll && <button className="lnk gn-more" onClick={() => setReqAll(true)}>Mind a {fmt(req.length)}</button>}
      </Card>}
      {ew.length > 0 && <Card eager className="s12" icon={P.alert} title="Ezeken a kérés nem segít" sub="Nem kerülnek a sorba, mert az oldalon kell változtatni hozzájuk.">
        <ul className="gx-e">{ew.map((x) => { const c = covPlain(x.coverage); return <li key={x.coverage}><b>{fmt(x.n)} cím: {c.l}</b><small>{c.step}</small></li>; })}</ul>
      </Card>}
    </>;
  }}</Async>;
}

/* ---------- near the first page, ranked by what it could bring ---------- */
/* one late day of Google's lists nothing: these tabs read at least 28 days, whatever the header says */
const atLeast28 = (period: number) => (period && period < 28 ? 28 : period);
const nearStep = (p: number) => (p <= 10 ? "Már az első oldal végén van: tedd a keresést a címbe." : p <= 14 ? "Közel van: írd a keresést egy alcímbe, és linkelj rá két rokon cikkből." : "Még messze van: bővítsd a cikket erre a témára.");
function Chances({ days: period, open }: { days: number; open: (u: string) => void }) {
  const q = useRpc("admin_search", { p_days: atLeast28(period), p_country: null, p_device: null, p_page: null, p_q: null, p_brand: "all" }, [period]);
  const tr = useTracked(); const [seo, setSeo] = useState<D | null>(null);
  return <Async q={q} h={320}>{(d) => {
    const ctr3 = d.ctr3 != null ? n(d.ctr3) : 0.11, opp = (r: D) => Math.max(0, Math.round(n(r.impressions) * ctr3 - n(r.clicks)));
    const near: D[] = [...(d.near || [])].sort((a, b) => opp(b) - opp(a)), low: D[] = d.low_ctr || [], rt = d.rows_totals || {}, t = d.totals || {};
    const Row = ({ r, step, extra }: { r: D; step: string; extra?: React.ReactNode }) => (
      <li><div className="gc-h"><button className="gc-t" onClick={() => open(r.page)}><b>„{r.query}”</b><small>{short(r.page) || "/"}</small></button><Star q={r.query} tr={tr} /></div>
        <div className="gc-m">{posChip(n(r.pos))}<span>{fmt(r.impressions)} megjelenés · {fmt(r.clicks)} kattintás</span>{extra}</div>
        <p className="gn-step"><b>Mit tegyél:</b> {step}</p><button className="lnk" onClick={() => setSeo(r)}>✦ Szöveges javaslat a cikkhez</button></li>);
    return <>
      <Card eager className="s12" icon={P.target} title={`Majdnem első oldal (${fmt(near.length)})`} sub={`A 8–20. helyen lévő keresések, a legtöbbet ígérő elöl. A „+” becslés: ennyivel több kattintás jöhetne az 1–3. helyen ${d.ctr3 != null ? "a saját kattintási arányoddal" : "iparági 11%-kal (a saját arányod még kevés adatból jönne)"}.`}>
        {near.length ? <ul className="gc-l">{near.map((r) => <Row key={r.query + r.page} r={r} step={nearStep(n(r.pos))} extra={<span className="chip gold">kb. +{fmt(opp(r))}</span>} />)}</ul> : <Empty t="A látható keresések között most nincs ilyen. Ebből nem derül ki, hogy tényleg nincs: a Google a keresések nagy részét nem mutatja meg." icon={P.target} />}
        <p className="note">A Google a {fmt(t.impressions)} megjelenésből {fmt(rt.impressions)}-nál ({pct(n(rt.impressions), n(t.impressions))}) mutatja meg a keresést. {period && period < 28 ? "Itt legalább 28 nap számít, rövidebb időből nem derül ki semmi." : "Az időszakot fent, a fejlécben válthatod."}</p>
      </Card>
      {low.length > 0 && <Card eager className="s12" icon={P.eye} title={`Sokan látják, kevesen kattintanak (${fmt(low.length)})`} sub="Már az első oldalon vannak, de a találat nem hívogató.">
        <ul className="gc-l">{low.map((r) => <Row key={r.query + r.page} r={r} step="Írd át a címet és a leírást: mondja ki, mit kap, aki rákattint." />)}</ul>
      </Card>}
      {seo && <SeoDrawer q={seo} close={() => setSeo(null)} />}
    </>;
  }}</Async>;
}

/* ---------- starred keywords ---------- */
function useTracked() {
  const sb = useMemo(sbNew, []);
  const q = useRpc("admin_ranks", { p_days: 28 }, []);
  const [local, setLocal] = useState<Record<string, boolean>>({}); const [bump, setBump] = useState(0);
  const set = useMemo(() => new Set<string>(((q.d?.tracked || []) as D[]).map((x) => String(x.query))), [q.d]);
  const on = (k: string) => (k in local ? local[k] : set.has(k));
  const toggle = async (k: string) => { const v = !on(k); haptic(10); setLocal((o) => ({ ...o, [k]: v })); const { error } = await rpc(sb, "admin_track_query", { p_q: k, p_on: v }); if (error) { setLocal((o) => ({ ...o, [k]: !v })); toast("Nem sikerült"); } else { toast(v ? "Csillagozva" : "Levéve"); setBump((b) => b + 1); } };
  /* the list above took it off or put it on: the star follows at once */
  const note = (k: string, v: boolean) => setLocal((o) => ({ ...o, [k]: v }));
  return { on, toggle, bump, note };
}
function Star({ q, tr }: { q: string; tr: ReturnType<typeof useTracked> }) {
  const v = tr.on(q);
  return <button className={"gc-star" + (v ? " on" : "")} aria-pressed={v} aria-label={v ? "Csillag levétele" : "Csillagozás"} onClick={() => tr.toggle(q)}>{v ? "★" : "☆"}</button>;
}
function Keywords({ days: period, open }: { days: number; open: (u: string) => void }) {
  const q = useRpc("admin_search", { p_days: atLeast28(period), p_country: null, p_device: null, p_page: null, p_q: null, p_brand: "all" }, [period]);
  const tr = useTracked(); const [all, setAll] = useState(false); const [by, setBy] = useState<"pos" | "clicks">("pos");
  /* a place of 0 means Google gave none: last, not first */
  const rows: D[] = ((q.d?.queries || []) as D[]).slice().sort((a, b) => (by === "pos" ? (n(a.pos) || 1e6) - (n(b.pos) || 1e6) : n(b.clicks) - n(a.clicks)));
  return <>
    <Card eager className="s12" icon={P.target} title="Csillagozott keresések" sub="Helyezésük görbéje napról napra. Csak a Google által megmutatott keresésekből számol, 1–3 nap késéssel. Ha egy csillagozott keresésnél 3 helyet romlasz, a csengő szól."><Ranks key={tr.bump} onChange={tr.note} /></Card>
    <Card eager className="s12" icon={P.search} title="Keresések, amikre megjelensz" sub={`A nagy szám az átlagos hely a Google-ben. A csillaggal követheted; az érintés az oldal adatlapját nyitja.${period && period < 28 ? " Itt legalább 28 nap számít, rövidebb időből nem derül ki semmi." : ""}`} right={<Pills items={[["pos", "Helyezés"], ["clicks", "Kattintás"]] as const} cur={by} pick={setBy} label="Rendezés" />}>
      {rows.length ? <ul className="ir-kws">{(all ? rows : rows.slice(0, 10)).map((r) => <li key={r.query + r.page}><BigPos p={n(r.pos)} /><button type="button" className="ir-kw-t" onClick={() => open(r.page)}><b>{r.query}</b><small>{short(r.page) || "/"}</small><small>{fmt(r.impressions)} megjelenés · {fmt(r.clicks)} kattintás</small></button><Star q={r.query} tr={tr} /></li>)}</ul>
        : <Empty t={q.d ? "Ebben az időszakban nincs látható keresés." : "Betöltés…"} icon={P.search} />}
      {rows.length > 10 && !all && <button className="lnk gn-more" onClick={() => setAll(true)}>Mind a {fmt(rows.length)}</button>}
    </Card>
  </>;
}

/* ---------- tickable SEO tasks, and what happened after the tick ---------- */
const STEP: Record<string, string> = {
  down: "Nézd meg, él-e az oldal; ha igen, a következő bejárás rendbe teszi.", status: "Nyisd meg a címet: ha nem kell, vedd ki az oldaltérképből, ha kell, javítsd.", redirect: "Linkelj közvetlenül a végső címre.",
  title: "Adj neki címet.", title_long: "Rövidítsd 60 karakter alá, a fontos szó elöl legyen.", title_short: "Bővítsd: mondja ki, miről szól, 30–60 karakterben.", title_dup: "Adj neki saját címet, ami csak erre az oldalra igaz.",
  meta: "Írj hozzá 1–2 mondatos leírást.", meta_long: "Rövidítsd 160 karakter alá.", h1: "Adj neki egy főcímet.", h1_many: "Csak egy főcím maradjon.", canonical: "Adj hozzá canonical linket, ami önmagára mutat.", canonical_other: "Ellenőrizd, valóban a másik oldal-e a fő változat.",
  noindex: "Ha szeretnéd a Google-ben látni, vedd le a tiltást.", alt: "Írj a képekhez rövid leírást.", thin: "Bővítsd a szöveget legalább 600 szóra.", schema: "Adj hozzá cikk- vagy GYIK-jelölést.", schema_bad: "Javítsd a hibás jelölést: a Google nem tudja olvasni.", slow: "Nézd meg a képek méretét és a betöltést.", hreflang: "Mindkét nyelvi változat mutasson a másikra.", hreflang_404: "Javítsd a hibás nyelvi címet.",
};
export function buildTasks(d: D): { key: string; t: string; step: string; c: string; url?: string; query?: string; kind: string }[] {
  const out: { key: string; t: string; step: string; c: string; url?: string; query?: string; kind: string }[] = [];
  ((d.pages || []) as D[]).forEach((p) => ((p.issues || []) as D[]).forEach((x) => { if (x.c !== "info") out.push({ key: `${x.k}:${p.url}`, t: String(x.t).replace(/\s*\(.*$/, ""), step: STEP[x.k] || "Nézd meg az oldalt.", c: x.c, url: p.url, kind: x.k }); }));
  ((d.cannibal || []) as D[]).forEach((c) => out.push({ key: `cannibal:${c.query}`, t: `„${c.query}”: ${fmt(c.pages)} oldalad versenyez egymással`, step: `Ez maradjon: ${short(c.list?.[0]?.page) || "/"}. A többi linkeljen rá.`, c: "warn", query: c.query, kind: "cannibal" }));
  ((d.orphans || []) as string[]).forEach((u) => out.push({ key: `orphan:${u}`, t: "Nem mutat rá link", step: "Tegyél rá linket egy rokon cikkből: a Google így találja meg.", c: "warn", url: u, kind: "orphan" }));
  const rank: Record<string, number> = { bad: 0, warn: 1 };
  return out.sort((a, b) => rank[a.c] - rank[b.c] || (a.kind === "cannibal" ? -1 : 0) - (b.kind === "cannibal" ? -1 : 0));
}
function perDay(x: D | null | undefined, k: string) { return x && n(x.days) ? n(x[k]) / n(x.days) : 0; }
function Effect({ r }: { r: D }) {
  if (!r.base) return <small>A hatása nem mérhető: nem egy oldalhoz kötődik.</small>;
  const a: D = r.after || {}, b: D = r.base;
  if (n(a.days) < 7) return <small>Még korai: {fmt(n(a.days))} mért nap van utána, 7-nél mutatjuk a hatást.</small>;
  if (!n(b.impressions) && !n(a.impressions)) return <small>Se előtte, se utána nincs megjelenése: nem mérhető.</small>;
  return <small>Naponta: {fmt(perDay(b, "impressions"), 1)} → <b>{fmt(perDay(a, "impressions"), 1)}</b> megjelenés, {fmt(perDay(b, "clicks"), 1)} → <b>{fmt(perDay(a, "clicks"), 1)}</b> kattintás{b.pos != null && a.pos != null ? <>, hely: {fmt(n(b.pos), 1)} → <b>{fmt(n(a.pos), 1)}</b></> : null}. Más is okozhatta.</small>;
}
function SeoTasksLoad({ open }: { open: (u: string) => void }) {
  const q = useRpc("admin_seo", { p_days: 30 }, []);
  return <Async q={q} h={260}>{(d) => <SeoTasks d={d} open={open} />}</Async>;
}
export function SeoTasks({ d, open }: { d: D; open?: (u: string) => void }) {
  const sb = useMemo(sbNew, []);
  const q = useRpc("admin_seo_tasks_list", undefined, []);
  const [hid, setHid] = useState<string[]>([]); const [all, setAll] = useState(false); const [pg, setPg] = useState<string | null>(null);
  const list: D[] = Array.isArray(q.d) ? (q.d as D[]) : [];
  const doneK = new Set(list.map((x) => x.key));
  const tasks = buildTasks(d).filter((x) => !doneK.has(x.key) && !hid.includes(x.key));
  const tips = ((d.pages || []) as D[]).reduce((a, p) => a + ((p.issues || []) as D[]).filter((x) => x.c === "info").length, 0);
  const see = (u?: string) => { if (u) (open || setPg)(u); };
  const tick = async (x: ReturnType<typeof buildTasks>[number]) => { haptic(12); setHid((h) => [...h, x.key]); const { error } = await rpc(sb, "admin_seo_task_set", { p_key: x.key, p_title: x.t, p_url: x.url || null, p_query: x.query || null, p_kind: x.kind, p_on: true }); if (error) { setHid((h) => h.filter((k) => k !== x.key)); toast("Nem sikerült menteni"); } else { toast("Kipipálva: a hatását később itt látod"); q.load(); } };
  const undo = async (k: string) => { const { error } = await rpc(sb, "admin_seo_task_set", { p_key: k, p_title: "", p_url: null, p_query: null, p_kind: null, p_on: false }); if (error) { toast("Nem sikerült visszavonni"); return; } setHid((h) => h.filter((x) => x !== k)); toast("Visszavonva"); q.load(); };
  return <>
    <Card eager className="s12" icon={P.check} title={`SEO-teendők (${fmt(tasks.length)})`} sub={`A heti bejárásból és a keresésekből, a hibák elöl. A pipa minden eszközön megmarad. ${fmt(tips)} apró tipp nincs a listában, azok a részleteknél vannak.`}>
      {tasks.length ? <ul className="gt-l">{(all ? tasks : tasks.slice(0, 10)).map((x) => <li key={x.key} className={x.c}>
        <button className="gt-ck" aria-label="Kész" onClick={() => tick(x)} />
        <div><button className="gx-u" onClick={() => see(x.url)} disabled={!x.url}><b>{x.t}</b>{x.url && <small>{short(x.url) || "/"}</small>}</button><p className="gn-step"><b>Mit tegyél:</b> {x.step}</p></div>
      </li>)}</ul> : <Empty t="Nincs nyitott SEO-teendő a legutóbbi bejárásból." icon={P.check} />}
      {tasks.length > 10 && !all && <button className="lnk gn-more" onClick={() => setAll(true)}>Mind a {fmt(tasks.length)}</button>}
    </Card>
    {list.length > 0 && <Card eager className="s12" icon={P.traffic} title={`Elvégezve (${fmt(list.length)})`} sub="Előtte: a pipa előtti 14 nap. Utána: a pipa óta eltelt mért napok, napi átlagban.">
      <ul className="gt-d">{list.map((r) => <li key={r.key}><b>{r.title}</b>{r.url && <small>{short(r.url) || "/"}</small>}{r.query && <small>„{r.query}”</small>}<Effect r={r} /><span className="mut gt-w">{ago(r.done_at)} <button className="lnk" onClick={() => undo(r.key)}>vissza</button></span></li>)}</ul>
    </Card>}
    {pg && <GooglePageSheet page={pg} close={() => setPg(null)} />}
  </>;
}

/* ---------- a page's three rings: is it in Google, where, how fast. Each says what it counts; what was not measured stays empty ---------- */
export function PageRings({ index, pos, speed }: { index?: D | null; pos?: number; speed?: D | null }) {
  const c = covPlain(index?.coverage, index?.verdict), known = !!index?.checked_at, inG = known && c.tone === "good";
  const p = pos && pos > 0 ? pos : 0, perf = speed?.perf != null ? n(speed.perf) : null;
  return <div className="ir-prs">
    <div><Ring p={inG ? 1 : 0} kind="solid" label={`Indexelés: ${known ? c.l : "még nem ellenőriztük"}`}><b>{known ? (inG ? "✓" : "✕") : "–"}</b></Ring><b>Indexelés</b><small>{known ? c.l : "még nem ellenőriztük"}</small></div>
    <div><Ring p={p ? Math.max(0, 21 - p) / 20 : 0} kind="seg" label={p ? `Átlagos hely: ${fmt(p, 1)}, az első 20 helyen mérve` : "A helyezés nem mérhető"}><b>{p ? fmt(p, 1) : "–"}</b></Ring><b>Helyezés</b><small>{p ? "az első 20 helyből" : "nincs adat"}</small></div>
    <div><Ring p={perf != null ? perf / 100 : 0} kind="tick" label={perf != null ? `Sebesség: ${fmt(perf)} a 100-ból` : "A sebesség nem mérhető"}><b>{perf != null ? fmt(perf) : "–"}</b></Ring><b>Sebesség</b><small>{perf != null ? "a 100-ból, telefonon" : "nem mérhető"}</small></div>
  </div>;
}

/* ---------- one page on one sheet ---------- */
export function GooglePageSheet({ page, days: d0 = 28, close }: { page: string; days?: number; close: () => void }) {
  const sb = useMemo(sbNew, []);
  const [url, setUrl] = useState(page);
  const q = useRpc("admin_google_page", { p_url: url, p_days: d0 }, [url, d0]);
  const [vAll, setVAll] = useState(false); const [done, setDone] = useState(false);
  useEffect(() => { pushRecent({ k: "gpage", id: url, l: url.replace(/^https?:\/\/[^/]+/, "") || "/" }); setDone(false); }, [url]);
  const x: D | null = q.d, ex: D | null = x?.exact || null, tr: D[] = x?.trend || [];
  const tc = ex ? n(ex.clicks) : tr.reduce((a, r) => a + n(r.clicks), 0), ti = ex ? n(ex.impressions) : tr.reduce((a, r) => a + n(r.impressions), 0);
  const tp = ex ? n(ex.pos) : ti ? tr.reduce((a, r) => a + n(r.pos) * n(r.impressions), 0) / ti : 0;
  const ix: D | null = x?.index || null, c = covPlain(ix?.coverage, ix?.verdict), seo: D | null = x?.seo || null, sp: D | null = x?.speed || null, vs: D[] = x?.versions || [];
  const issues: D[] = ((seo?.issues || []) as D[]).filter((i) => i.c !== "info");
  const tick = async () => { setDone(true); const { error } = await rpc(sb, "admin_index_request_set", { p_url: url, p_on: true }); if (error) { setDone(false); toast("Nem sikerült menteni"); } else { toast("Kipipálva"); dispatchEvent(new CustomEvent(INDEX_TICK, { detail: url })); } };
  return (
    <Sheet tall title={short(url) || "/"} sub={`Google · ${d0} nap`} close={close} foot={<a className="adm-ibtn" href={url} target="_blank" rel="noreferrer">Az oldal megnyitása ↗</a>}>
      {!x ? <div className="skel" style={{ height: 220 }} /> : <div className="gs">
        <PageRings index={ix} pos={tp} speed={sp} />
        <div className={"gs-idx t-" + (c.tone || "info")}><b>{c.l}</b>{c.step && <small>{c.step}</small>}{ix?.checked_at ? <small>Ellenőrizve: {ago(ix.checked_at)}{ix.last_crawl ? ` · utoljára olvasta: ${ago(ix.last_crawl)}` : ""}</small> : <small>Ezt a címet még nem ellenőriztük, vagy nincs az oldaltérképben.</small>}
          {x.requested ? <small>Indexelést kértél: {ago(x.requested)}</small> : done ? <small>Indexelést kértél: most</small> : null}
          {c.req && !x.requested && !done && <div className="gx-b"><a className="adm-ibtn gold" href={inspectUrl(ix?.inspect_link)} target="_blank" rel="noreferrer" onClick={() => copyUrl(url)}>Másol és megnyit</a><button className="adm-ibtn" onClick={tick}>Kértem ✓</button></div>}
        </div>
        <div className="mini-stats gs-m"><Mini l="Kattintás" v={fmt(tc)} /><Mini l="Megjelenés" v={compact(ti)} /><Mini l="Kattintási arány" v={ti ? pct(tc, ti) : "–"} /><Mini l="Átlagos hely" v={tp ? fmt(tp, 1) + "." : "–"} /></div>
        {!ex && <p className="note">Csak a Google által megmutatott keresésekből: az oldal valódi száma nagyobb lehet.</p>}
        {tr.length > 1 ? <><TrendChart data={tr.map((r) => ({ t: r.t, v: n(r.impressions), p: n(r.clicks) }))} label="Megjelenés" prevLabel="Kattintás" height={130} /><div className="legend ir-lines"><span><i />Megjelenés</span><span><i className="d" />Kattintás</span></div></> : <p className="note">Görbéhez két nap adat kell.</p>}
        <h3>Sebesség</h3>
        {sp ? <p className="gs-p">A Google mérése telefonon: <b>{fmt(sp.perf)} / 100</b>, a fő tartalom {fmt(n(sp.lcp) / 1000, 1)} mp alatt jelenik meg <small className="mut">({dShort(sp.day)})</small></p>
          : <p className="gs-p">Nem mérhető: a Google sebességmérése csak néhány kiemelt oldalra fut.{seo?.ms != null ? <> A heti bejáráskor a szerver {fmt(seo.ms)} ms alatt válaszolt, ez nem ugyanaz.</> : null}</p>}
        <h3>Nyelvi változatok ({fmt(vs.length)})</h3>
        {vs.length ? <ul className="gs-v">{(vAll ? vs : vs.slice(0, 6)).map((v) => <li key={v.url} className={v.url === url ? "cur" : ""}><button onClick={() => setUrl(v.url)}><b>{lang(v.lang)}</b><small>{covPlain(v.coverage, v.ok ? "PASS" : null).l}</small><span>{fmt(v.clicks)} katt. · {fmt(v.impressions)} megj.</span></button></li>)}</ul> : <p className="note">Nincs ellenőrzött nyelvi változata.</p>}
        {vs.length > 6 && !vAll && <button className="lnk gn-more" onClick={() => setVAll(true)}>Mind a {fmt(vs.length)}</button>}
        <h3>Keresések, amikre megjelenik</h3>
        {(x.queries || []).length ? <ul className="gs-q">{(x.queries as D[]).slice(0, 8).map((r) => <li key={r.query}><span>{r.query}</span>{posChip(n(r.pos))}<small>{fmt(r.impressions)} megj. · {fmt(r.clicks)} katt.</small></li>)}</ul> : <p className="note">A Google ennél az oldalnál nem mutat keresést.</p>}
        {issues.length > 0 && <><h3>Javítanivaló a heti bejárásból</h3><ul className="gs-q">{issues.map((i) => <li key={i.k + i.t}><span>{i.t}</span><small>{STEP[i.k] || ""}</small></li>)}</ul></>}
      </div>}
    </Sheet>
  );
}
