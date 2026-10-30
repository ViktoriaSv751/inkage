"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { BarList, Empty, TrendChart, fmt, pct } from "../charts";
import { toast } from "../phone";
import { AI_DAILY, Band, Card, EV, I, Kpi, Layer, Loading, MOCK, P, StateErr, Tbl, ago, api, dt, human, n, rpc, short, type D, useRpc } from "../shared";

/* ---------- monitoring: is the site up, did the scheduled jobs really run, which errors are open, what is slow ---------- */
export const JOB: Record<string, string> = { "admin-sync": "Reggeli adatlehúzás", "admin-social": "Óránkénti közösségi lehúzás", "admin-digest": "Reggeli összefoglaló", "admin-rollup": "Napi összesítő (10 perc)", "admin-rollup-week": "Hajnali újraszámolás (7 nap)", "admin-bots": "Robot- és tesztszűrés (óránként)",
  "admin-index": "Google-indexelés", "admin-cwv": "Oldalsebesség", "admin-publish": "Publikálás (10 perc)", "admin-weekly": "Heti riport e-mail", "admin-uptime": "Elérhetőség (5 perc)", "admin-seo": "Heti SEO-bejárás",
  "admin-watch": "Napi figyelés", "admin-aivis": "MI-láthatóság (heti)", "admin-rules": "Riasztási szabályok (5 perc)" };
const PATHN: Record<string, string> = { "/api/admin/sync": "Reggeli lehúzás", "/api/admin/sync?only=social": "Közösségi lehúzás", "/api/admin/digest": "Reggeli összefoglaló", "/api/admin/digest?weekly=1": "Heti riport",
  "/api/admin/publish": "Publikálás", "/api/admin/sync?only=index": "Google-indexelés", "/api/admin/sync?only=cwv": "Oldalsebesség", "/api/admin/sync?only=seo": "SEO-bejárás", "/api/admin/sync?only=watch": "Napi figyelés",
  "/api/admin/sync?only=aivis": "MI-láthatóság", "/api/admin/sync?only=rules": "Riasztási szabályok" };
const SRC: Record<string, string> = { tiktok: "TikTok", instagram: "Instagram", facebook: "Facebook", pinterest: "Pinterest", linkedin: "LinkedIn", youtube: "YouTube", gsc: "Search Console", gsc_index: "Google-indexelés",
  apple: "App Store", apple_analytics: "App Store analitika", google: "Google Play", google_quality: "Play minőség", competitors: "Áruházi versenytársak", seo: "SEO-bejárás", kw_ideas: "Kulcsszóötletek", bing: "Bing",
  cwv: "Oldalsebesség", watch: "Napi figyelés", aivis: "MI-láthatóság", cse: "Programmable Search" };
const METRIC: Record<string, string> = { errors: "Hibák száma", sessions: "Látogatás", scored: "Előnézet", score_rate: "Előnézetig jutók %-a", down: "Kiesések száma", latency: "Válaszidő (ms)", signups: "Regisztráció",
  /* per platform: what its posts gathered in the window, visits from it, the change of its followers */
  ...Object.fromEntries(Object.entries({ tiktok: "TikTok", instagram: "Instagram", facebook: "Facebook", pinterest: "Pinterest", linkedin: "LinkedIn", youtube: "YouTube" }).flatMap(([k, l]) => [["pf_views:" + k, `${l}: megtekintés`], ["pf_visits:" + k, `${l}: látogatás innen`], ["pf_followers:" + k, `${l}: követőváltozás`]])) };
const CHN: Record<string, string> = { push: "Push", telegram: "Telegram", email: "E-mail" };
const ST: Record<string, [string, string]> = { open: ["Nyitott", "warn"], resolved: ["Megoldva", "good"], ignored: ["Figyelmen kívül", ""] };
const MB = (b: number) => (b > 1e9 ? fmt(b / 1e9, 2) + " GB" : fmt(b / 1e6, 1) + " MB");
const daysTo = (t?: string | null) => (t ? Math.round((new Date(t).getTime() - Date.now()) / 864e5) : null);
const tone = (d: number | null, warn: number, bad: number) => (d == null ? "sky" : d < bad ? "pink" : d < warn ? "butter" : "mint");

/* "0 4 * * *" in UTC → "minden nap 6:00" in Budapest (summer and winter time handled by the date itself) */
export function cronHu(s: string) {
  const [mi, h, , , dow] = String(s || "").split(/\s+/);
  if (/^\*\/\d+$/.test(mi) && h === "*") return `${mi.slice(2)} percenként`;
  if (/^\d+$/.test(mi) && h === "*") return `óránként, :${mi.padStart(2, "0")}-kor`;
  if (/^\d+$/.test(mi) && /^\d+$/.test(h)) {
    const d = new Date(); d.setUTCHours(Number(h), Number(mi), 0, 0);
    const t = d.toLocaleTimeString("hu-HU", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Budapest" });
    const days = ["vasárnap", "hétfőn", "kedden", "szerdán", "csütörtökön", "pénteken", "szombaton"];
    return (dow && dow !== "*" && /^\d$/.test(dow) ? `${days[Number(dow) % 7]} ` : "minden nap ") + t;
  }
  return s;
}

/* the real state of a scheduled job: the HTTP answer of its call and the route's own record of the run */
/* (the same rule as the database's admin_jobs_failing: the badge, the self-check and this list agree) */
export function jobState(c: D): { t: string; tone: string; why?: string } {
  if (c.active === false) return { t: "ki van kapcsolva", tone: "" };
  const h = c.http, r = c.run;
  const hand = h?.via === "admin" ? " · kézi" : "";
  if (c.path && (h || r)) {
    if (r && !r.finished_at) return { t: "fut…" + hand, tone: "gold" };
    /* pg_net hands over the HTTP answer only at the next 5-minute round: a run that already finished is not "fut…" */
    const runDone = !!(r?.finished_at && h && new Date(r.started_at).getTime() >= new Date(h.at).getTime() - 60e3);
    if (h && !h.done && !runDone) return { t: "fut…" + hand, tone: "gold" };
    if (h && !h.done && runDone) return r.ok === false ? { t: "✕ hibával futott" + hand, tone: "bad", why: r.message } : { t: "✓ rendben" + hand, tone: "good", why: r.message };
    if (h && (h.timed_out || h.status == null || h.status < 200 || h.status > 299)) return { t: h.timed_out ? "✕ időtúllépés" : h.status ? `✕ HTTP ${h.status}` : "✕ nincs válasz", tone: "bad", why: h.error || r?.message };
    if (r && r.ok === false) return { t: "✕ hibával futott" + hand, tone: "bad", why: r.message };
    return { t: "✓ rendben" + hand, tone: "good", why: r?.message };
  }
  if (!c.last) return { t: "még nem futott", tone: "" };
  if (c.last.status !== "succeeded" && c.done_at && new Date(c.done_at) > new Date(c.last.start)) return { t: "✓ rendben (azóta lefutott)", tone: "good", why: `A ${new Date(c.last.start).toLocaleString("hu-HU")}-i futás hibás volt (${c.last.msg || c.last.status}); ${new Date(c.done_at).toLocaleString("hu-HU")}-kor már rendben lefutott.` };
  return c.last.status === "succeeded" ? { t: c.path ? "✓ elindult" : "✓ rendben", tone: c.path ? "gold" : "good", why: c.path ? "A hívás elindult; a válasz az első 5 perces mérés után látszik." : undefined } : { t: "✕ " + c.last.status, tone: "bad", why: c.last.msg };
}

export function Monitor() {
  const sb = useMemo(() => supabaseBrowser(), []);
  const q = useRpc("admin_monitor", undefined, []), { d, e, load } = q;
  const [open, setOpen] = useState<D | null>(null); const [ef, setEf] = useState("open");
  const [vercel, setVercel] = useState<D | null>(null);
  useEffect(() => { if (!MOCK) api("/api/admin/status?vercel=1").then((r) => setVercel(r.ok ? r.json : null)).catch(() => null); }, []);
  if (e && !d) return <div className="g"><div className="s12"><StateErr msg={e} retry={load} /></div></div>;
  if (!d) return <Loading />;
  /* a watched address answering slower than 2 s on average (and still measured in the last hour) */
  const slowNow = (x: D) => x.on_ !== false && n(x.avg_ms) > 2000 && !!x.last?.at && Date.now() - new Date(x.last.at).getTime() < 3600e3;
  const up: D[] = d.uptime || [], days: D[] = d.uptime_days || [], cron: D[] = d.cron || [], errs: D[] = d.errors || [];
  const totalN = up.reduce((t, x) => t + n(x.n), 0), totalUp = up.reduce((t, x) => t + n(x.up), 0);
  const avail = totalN ? (totalUp / totalN) * 100 : 0, since: string | null = d.uptime_since || null;
  const shown = errs.filter((x) => ef === "all" || (ef === "regressed" ? x.regressed : x.state === ef));
  const states = cron.map((c) => ({ c, s: jobState(c) })), failing = states.filter((x) => x.s.tone === "bad");
  const setState = async (fp: string, state: string, note?: string) => { const r = await rpc(sb, "admin_error_state", { p_fp: fp, p_state: state, p_note: note ?? null }); if (r.error) return toast("Nem sikerült: " + r.error.message); toast(ST[state][0]); load(); setOpen(null); };
  const cert = ((d.certs || []) as D[])[0], cd = daysTo(cert?.valid_to), dd = daysTo(cert?.domain_expires);
  const hb = d.heartbeat ? (Date.now() - new Date(d.heartbeat).getTime()) / 60e3 : null;
  const dbWarn = n(d.db_bytes) > 400e6;
  return (
    <div className="g">
      {hb != null && hb > 15 && <div className="alert err s12">A mérés {fmt(hb)} perce állt: a Supabase időzítője nem fut, ezért minden szám ezen az oldalon régi. Nézd meg a Supabase állapotát. <a href="https://status.supabase.com" target="_blank" rel="noreferrer">status.supabase.com ↗</a></div>}
      {/* availability only over the time there is data (a 30-day label on a few hours was a promise it could not keep) */}
      <Band label={`Elérhetőség · ${since && Date.now() - new Date(since).getTime() < 29 * 864e5 ? `${dt(since)} óta` : "30 nap"}`} value={Number(avail.toFixed(2))} d={2} fmtFn={(x) => fmt(x, 2) + "%"} sentence={<>5 percenként ellenőrizzük a lenti címeket; minden cím az első sikeres válaszától számít (amíg egy cím még nem létezett, nem „esett ki”). {up.some((x) => x.on_ !== false && x.last && !x.last.ok) ? <b className="down">Most van kieső cím!</b> : "Most minden válaszol."} Utolsó mérés: {d.heartbeat ? ago(d.heartbeat) : "–"}. A válaszidőt a weboldal szervere méri 5 percenként, címenként külön (az adatbázis időzítője csak azt látja, hogy válaszolt-e). Ha a Supabase áll, ez az oldal sem mér: egy ingyenes külső figyelő (pl. UptimeRobot a /api/config címre) ezt is lefedi.</>}
        side={days.filter((x) => x.ms != null).length > 1 ? <TrendChart data={days.filter((x) => x.ms != null).map((x) => ({ t: x.day, v: n(x.ms) }))} label="Átl. válaszidő (ms, szerverről mérve)" height={110} /> : undefined} />
      <Kpi kind="own" to="@next" tone={failing.length ? "pink" : "mint"} className="s3" icon={P.clock} l="Időzített feladatok" v={`${cron.length - failing.length} / ${cron.length}`} sub={failing.length ? `${failing.length} hibával futott: ${failing.map((x) => JOB[x.c.jobname] || x.c.jobname).slice(0, 2).join(", ")}` : "a valódi válasz szerint mind rendben"} />
      <Kpi kind="own" tone={errs.some((x) => x.state === "open") ? "butter" : "mint"} className="s3" icon={P.alert} l="Nyitott hibacsoport" v={fmt(errs.filter((x) => x.state === "open").length)} sub={`${fmt(errs.filter((x) => x.regressed).length)} visszatért`} />
      <Kpi kind="own" to="@next" tone={tone(Math.min(cd ?? 999, (dd ?? 999) - 16), 30, 14) as any} className="s3" icon={P.bolt} l="Tanúsítvány" v={cd != null ? `${fmt(cd)} nap` : "–"} sub={cert?.domain_expires ? <span className={dd != null && dd < 30 ? "down" : ""}>domain: {new Date(cert.domain_expires).toLocaleDateString("hu-HU")} ({fmt(dd)} nap)</span> : "naponta ellenőrizve"} />
      <Kpi kind="own" to="@next" tone={dbWarn ? "pink" : "lilac"} className="s3" icon={P.layers} l="Adatbázis" v={MB(n(d.db_bytes))} sub={dbWarn ? <b>400 MB fölött: az ingyenes keret 500 MB</b> : `tárhely: ${MB(n(d.storage_bytes))} · ${pct(n(d.db_bytes), 500e6)} az 500 MB-ból`} />

      {up.some(slowNow) && <div className="alert err s12">Lassú válasz (2 másodperc fölött átlagosan): {up.filter(slowNow).map((x) => `${x.label || short(x.target) || "/"} ${fmt(x.avg_ms)} ms`).join(" · ")}</div>}
      <Card className="s12" icon={P.globe} title="Elérhetőség címenként" sub="Az utolsó ellenőrzés, a rendelkezésre állás a cím első sikeres válaszától (legfeljebb 30 nap), az átlagos és a lassú (95%-os) válaszidő, és mikor esett ki utoljára. A válaszidő valódi mérés: a weboldal szervere 5 percenként lekéri a címet, és méri, mennyi idő alatt jön meg a válasz (címenként külön). Az adatbázis időzítője csak azt nézi, válaszol-e: az ő ideje a saját sorban állása volt, ezért azt már nem mutatjuk.">
        <Tbl name="elerhetoseg" rows={up} empty="Az első ellenőrzés 5 percen belül lefut." cols={[
          { k: "target", l: "Cím", r: (r) => <span><b>{r.label || short(r.target) || "/"}</b>{r.on_ === false && <span className="chip" style={{ marginLeft: 6 }}>kikapcsolva</span>}<br /><span className="mut">{short(r.target)}</span></span> },
          { k: "last", l: "Most", r: (r) => (r.last ? <span className={"chip " + (r.last.ok ? "good" : "bad")}>{r.last.ok ? "✓ " + r.last.status : "✕ " + (r.last.status || "nincs válasz")}</span> : "–") },
          { k: "up", l: "Elérhető", num: true, r: (r) => <span title={r.since ? `${dt(r.since)} óta` : ""}>{pct(n(r.up), n(r.n), 2)}</span> },
          { k: "avg_ms", l: "Átlag", num: true, r: (r) => (r.avg_ms != null ? (n(r.avg_ms) > 2000 ? <span className="down" title="2 másodperc fölött lassú">{fmt(r.avg_ms)} ms · lassú</span> : `${fmt(r.avg_ms)} ms`) : <span className="mut" title="A szerver mérése a következő telepítés után indul">még nincs mérés</span>) },
          { k: "p95_ms", l: "Lassú (95%)", num: true, r: (r) => (r.p95_ms != null ? `${fmt(r.p95_ms)} ms` : <span className="mut">–</span>) },
          { k: "last_down", l: "Utolsó kiesés", r: (r) => (r.last_down ? ago(r.last_down) : <span className="mut">30 napja nem</span>) },
        ]} />
        <Outages up={up} />
        <Targets d={d} reload={load} />
      </Card>

      <Card className="s12" icon={P.clock} title="Időzített feladatok" sub="Mindegyik feladat valódi állapota: a hívás HTTP-válasza és a lehúzás saját naplója (lefutott-e, és hibával vagy anélkül). Az idők budapesti idő szerint. „Futtatás most”: azonnal elindítja; a kapcsolóval szüneteltethető.">
        <Tbl name="idozitett" rows={states.map((x) => ({ ...x.c, _s: x.s }))} cols={[
          { k: "jobname", l: "Feladat", r: (r) => <span><b>{JOB[r.jobname] || r.jobname}</b><br /><span className="mut">{cronHu(r.schedule)}</span></span> },
          { k: "_s", l: "Állapot", r: (r) => <span title={r._s.why || ""}><span className={"chip " + r._s.tone}>{r._s.t}</span>{r._s.why && r._s.tone === "bad" && <><br /><span className="mut cellwrap" style={{ fontSize: 11.5 }}>{String(r._s.why).slice(0, 140)}</span></>}</span> },
          { k: "last", l: "Utoljára", r: (r) => { const t = r.run?.started_at || r.http?.at || r.last?.start; return t ? <span title={dt(t)}>{ago(t)}{r.http?.status ? <span className="mut"> · HTTP {r.http.status}</span> : null}</span> : <span className="mut">még nem futott</span>; } },
          { k: "fails_7d", l: "Hiba / 7 nap", num: true, r: (r) => <span className={n(r.fails_7d) ? "down" : ""}>{fmt(r.fails_7d)} / {fmt(r.runs_7d)}</span> },
          { k: "x", l: "", r: (r) => <JobTools c={r} reload={load} /> },
        ]} />
      </Card>

      <DataQuality />
      <Card className="s7" icon={P.refresh} title="Lehúzások forrásonként" sub="A napló szerint (30 nap): mikor sikerült utoljára, mikor volt hiba és mi, és hány sikeres / hibás futás volt egy hét alatt.">
        <Tbl name="lehuzasok" rows={d.syncs || []} empty="Még nincs lehúzás a naplóban." cols={[
          { k: "source", l: "Forrás", r: (r) => <b>{SRC[r.source] || r.source}</b> },
          { k: "last_state", l: "Állapot", r: (r) => (!r.last_state && r.unconnected ? <span className="chip" title="Nincs fiók vagy kulcs hozzá: ez nem hiba, a forrás kimarad, amíg be nem kötöd (Kapcsolatok)">– nincs bekötve</span> : <span className={"chip " + (r.last_state ? "good" : "bad")}>{r.last_state ? "✓ rendben" : "✕ hiba"}</span>) },
          { k: "last_ok", l: "Utolsó jó", r: (r) => (r.last_ok ? ago(r.last_ok) : "–") },
          { k: "err_msg", l: "Utolsó hiba", r: (r) => (r.last_err && !r.last_state && r.unconnected ? <span className="cellwrap" title={r.err_msg || ""}><span className="mut">nincs bekötve:</span> {String(r.err_msg || "").replace(/^nincs bekötve: /, "").slice(0, 100)} <a className="lnk" href="#connect">Kapcsolatok</a></span> : r.last_err ? <span className="cellwrap" title={r.err_msg || ""}><span className="mut">{ago(r.last_err)}:</span> {String(r.err_msg || "").slice(0, 100)}</span> : <span className="mut">–</span>) },
          { k: "ok_7d", l: "7 nap", num: true, r: (r) => <span>{fmt(r.ok_7d)}{n(r.err_7d) ? <span className="down"> / {fmt(r.err_7d)} hiba</span> : null}</span> },
        ]} />
      </Card>
      <Card className="s5" icon={P.system} title="Szerveroldali hibák" sub="A lehúzások kivételei és a félbeszakadt vagy hibás futások (14 nap), üzenetenként összevonva.">
        {(d.server_errors || []).length ? <ul className="srv-errs">{(d.server_errors as D[]).slice(0, 12).map((x, i) => <li key={i}><b>{SRC[x.source] || PATHN[String(x.source).replace("futás: ", "")] || x.source}</b><span>{String(x.msg || "–").slice(0, 160)}</span><small>{fmt(x.n)}× · utoljára {ago(x.last)}</small></li>)}</ul> : <Empty t="Nincs szerveroldali hiba. ✓" icon={P.check} />}
      </Card>

      <Card className="s12" icon={P.alert} title="Hibacsoportok" sub="A felhasználóknál történt hibák összevonva (azonos üzenet és hely): hány embert érintett, mikor először és utoljára. A „Megoldva” után ha újra előjön, „Visszatért” jelzést kap. Kattints egy sorra: jegyzet, a hiba előtti lépések több látogatásból, és az MI-elemzés (megmarad)."
        right={<div className="adm-seg sm">{[["open", "Nyitott"], ["regressed", "Visszatért"], ["resolved", "Megoldva"], ["ignored", "Figyelmen kívül"], ["all", "Mind"]].map(([k, l]) => <button key={k} aria-pressed={ef === k} onClick={() => setEf(k)}>{l}</button>)}</div>}>
        <Tbl name="hibacsoportok" rows={shown} onRow={setOpen} empty="Nincs ilyen hibacsoport." cols={[
          { k: "msg", l: "Hiba", r: (r) => <span className="cellwrap"><b>{human(r.msg)}</b>{r.regressed && <span className="chip bad" style={{ marginLeft: 6 }}>visszatért</span>}{r.note && <span className="chip" style={{ marginLeft: 6 }} title={r.note}>jegyzet</span>}<br /><span className="mut">{EV[r.name] || r.name}{r.where_ ? " · " + r.where_ : ""}{r.path ? " · " + r.path : ""}</span></span> },
          { k: "people", l: "Ember", num: true, r: (r) => <b>{fmt(r.people)}</b> }, { k: "n", l: "Eset", num: true },
          { k: "last", l: "Utoljára", r: (r) => ago(r.last) }, { k: "first", l: "Először", r: (r) => ago(r.first) },
          { k: "state", l: "Állapot", r: (r) => <span className={"chip " + (ST[r.state]?.[1] || "")}>{ST[r.state]?.[0] || r.state}</span> },
        ]} />
      </Card>

      <Rules d={d} reload={load} />
      <Runs runs={d.runs || []} />

      <Card className="s6" icon={P.layers} title="Kiadások" sub="Minden új verzió a weboldalon (Vercel-telepítés): mikor ment ki (az első kérés rögzíti, percekkel a telepítés után), és hány új hibacsoport jelent meg utána egy napon belül.">
        {(d.releases || []).length ? <ul className="rels">{(d.releases as D[]).map((r) => { const nw = errs.filter((x) => new Date(x.first).getTime() > new Date(r.at).getTime() && new Date(x.first).getTime() < new Date(r.at).getTime() + 864e5).length;
          return <li key={r.sha}><code>{r.sha.slice(0, 7)}</code><span>{r.msg || "–"}</span><small>{dt(r.at)}</small>{nw ? <span className="chip bad">{nw} új hiba</span> : <span className="chip good">tiszta</span>}</li>; })}</ul> : <Empty t="Az első kiadás a következő telepítés után jelenik meg." />}
        <VercelBuilds v={vercel} />
      </Card>
      <EmailCard rows={(d.email || []) as D[]} />

      <Quotas d={d} />
      <PushHealth p={d.push || {}} />

      <Card className="s7" icon={P.system} title="A leglassabb adatbázis-lekérdezések" sub="Átlagos futásidő szerint (pg_stat_statements). Ha egy irányítóközpont-oldal lassú, általában itt látszik az oka.">
        <Tbl name="lassu-lekerdezesek" rows={d.slow || []} cols={[{ k: "q", l: "Lekérdezés", r: (r) => <code className="cellwrap" style={{ fontSize: 11 }}>{r.q}</code> }, { k: "mean_ms", l: "Átlag", num: true, r: (r) => `${fmt(r.mean_ms, 1)} ms` }, { k: "calls", l: "Hívás", num: true }]} />
      </Card>
      <Card className="s5" icon={P.layers} title="A legnagyobb táblák" sub="A Supabase ingyenes csomagja 500 MB adatbázist ad; 400 MB fölött jelzést kapsz."><BarList items={((d.tables || []) as D[]).map((x) => ({ k: x.t, n: n(x.bytes), sub: `${fmt(x.rows)} sor` }))} fmtK={(k) => k} /><p className={"note" + (dbWarn ? " down" : "")}>Összesen: {MB(n(d.db_bytes))} ({pct(n(d.db_bytes), 500e6)} az 500 MB-ból)</p></Card>
      {open && <ErrorSheet x={open} close={() => setOpen(null)} setState={setState} reload={load} />}
    </div>
  );
}

/* the outages of 30 days, newest first: from when to when, how many checks failed */
function Outages({ up }: { up: D[] }) {
  const all: D[] = up.flatMap((u) => ((u.downs || []) as D[]).map((x): D => ({ ...x, l: u.label || short(u.target) }))).sort((a, b) => String(b.from).localeCompare(String(a.from))).slice(0, 12);
  if (!all.length) return null;
  return (
    <div className="outages"><h4>Kiesések (30 nap)</h4>
      <ol className="tline">{all.map((x, i) => <li key={i} className="bad"><time>{dt(x.from)}</time><span><b>{x.l}</b> · {x.n > 1 ? `${fmt(x.n)} ellenőrzésen át, kb. ${fmt(Math.max(5, (new Date(x.to).getTime() - new Date(x.from).getTime()) / 60e3 + 5))} percig` : "egy ellenőrzésnél"}</span></li>)}</ol>
    </div>
  );
}

/* the addresses checked every 5 minutes: add one, switch one off, remove one */
function Targets({ d, reload }: { d: D; reload: () => void }) {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [open, setOpen] = useState(false); const [url, setUrl] = useState("https://inkage.app/"); const [label, setLabel] = useState(""); const [msg, setMsg] = useState("");
  const save = async (u: string, on: boolean | null, l?: string) => { setMsg(""); const r = await rpc(sb, "admin_uptime_target_save", { p_url: u, p_on: on, p_label: l || null, p_ok_max: null }); if (r.error) { setMsg(r.error.message); return false; } reload(); return true; };
  return (
    <div className="targets">
      <button className="lnk" onClick={() => setOpen(!open)}>{open ? "Bezárás" : "Címek szerkesztése"}</button>
      {open && <>
        <ul className="rules">{((d.targets || []) as D[]).map((t) => <li key={t.url}><span><b>{t.label || short(t.url)}</b> <small>{t.url}{t.ok_max > 399 ? ` · ${t.ok_max}-ig jó` : ""}</small></span>
          <span className="adm-row"><button className={"sw" + (t.on_ ? " on" : "")} role="switch" aria-checked={!!t.on_} aria-label="Ellenőrzés be/ki" onClick={() => save(t.url, !t.on_)}><i /></button>
            <button className="lnk" onClick={() => { if (confirm(`Törlöd: ${t.url}? A korábbi mérések megmaradnak.`)) save(t.url, null); }}>törlés</button></span></li>)}</ul>
        <form className="rule-f" onSubmit={async (e) => { e.preventDefault(); if (await save(url.trim(), true, label.trim())) { setUrl("https://inkage.app/"); setLabel(""); toast("Cím hozzáadva"); } }}>
          <input className="adm-in sm" value={url} onChange={(e) => setUrl(e.target.value)} aria-label="Cím" placeholder="https://inkage.app/…" />
          <input className="adm-in sm" value={label} onChange={(e) => setLabel(e.target.value)} aria-label="Név" placeholder="Név (nem kötelező)" />
          <button className="adm-ibtn gold sm">{I(P.plus)}Hozzáadás</button>
        </form>
        {msg && <p className="note down">{msg}</p>}
      </>}
    </div>
  );
}

/* a job's switch and "Futtatás most" */
function JobTools({ c, reload }: { c: D; reload: () => void }) {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [busy, setBusy] = useState(false);
  const run = async () => { if (!confirm(`Elindítod most: ${JOB[c.jobname] || c.jobname}?`)) return; setBusy(true); const r = await rpc(sb, "admin_cron_run", { p_job: c.jobname }); setBusy(false); toast(r.error ? "Nem sikerült: " + r.error.message : "Elindítva: az eredmény pár percen belül itt látszik"); setTimeout(reload, 4000); };
  const toggle = async () => { const r = await rpc(sb, "admin_cron_toggle", { p_job: c.jobname, p_on: c.active === false }); toast(r.error ? "Nem sikerült: " + r.error.message : c.active === false ? "Bekapcsolva" : "Szüneteltetve"); reload(); };
  return (
    <span className="adm-row" style={{ flexWrap: "nowrap" }} onClick={(e) => e.stopPropagation()}>
      <button className={"sw" + (c.active !== false ? " on" : "")} role="switch" aria-checked={c.active !== false} aria-label="Feladat be/ki" title={c.active !== false ? "Fut (kattintásra szünetel)" : "Szünetel (kattintásra fut)"} onClick={toggle}><i /></button>
      <button className="adm-ibtn sm" onClick={run} disabled={busy}>{busy ? "Indul…" : "Futtatás most"}</button>
    </span>
  );
}

/* the last runs of the routes, with their own summary (the 5-minute rules only when they failed) */
function Runs({ runs }: { runs: D[] }) {
  const [all, setAll] = useState(false);
  const rows = all ? runs : runs.slice(0, 12);
  return (
    <Card className="s7" icon={P.doc} title="Futási napló" sub="Minden lehúzás, összefoglaló és publikálás saját bejegyzése: mikor indult, meddig tartott, mit csinált, és ha hibás volt, miért. A 5 perces szabályfutások csak hiba esetén.">
      {rows.length ? <ol className="tline runs">{rows.map((r) => {
        const sec = r.finished_at ? Math.max(0, (new Date(r.finished_at).getTime() - new Date(r.started_at).getTime()) / 1000) : null;
        return <li key={r.id} className={r.ok === false ? "bad" : r.ok ? "" : "run"}><time>{dt(r.started_at)}</time><span><b>{PATHN[r.job] || r.job}</b>{r.via === "admin" ? <span className="chip" style={{ marginLeft: 6 }}>kézi</span> : null} · {r.ok == null ? "fut…" : r.ok ? "✓" : "✕"}{sec != null ? ` · ${fmt(sec, sec < 10 ? 1 : 0)} mp` : ""}<br /><span className="mut cellwrap">{String(r.message || "").slice(0, 220)}</span></span></li>;
      })}</ol> : <Empty t="Az első futás után itt látszik (a frissítés telepítése után)." />}
      {runs.length > 12 && <button className="lnk" onClick={() => setAll(!all)}>{all ? "Kevesebb" : `Mind a ${runs.length}`}</button>}
    </Card>
  );
}

/* ---------- alert rules: switch, edit, delete (with a question), channels ---------- */
function Rules({ d, reload }: { d: D; reload: () => void }) {
  const sb = useMemo(() => supabaseBrowser(), []);
  const blank = { id: null as number | null, metric: "errors", op: ">", threshold: "10", window_min: "60", channels: ["push"] as string[] };
  const [rule, setRule] = useState(blank); const [msg, setMsg] = useState("");
  const save = async (ev: React.FormEvent) => {
    ev.preventDefault(); setMsg("");
    const th = Number(String(rule.threshold).replace(",", "."));
    if (!Number.isFinite(th) || th < 0) { setMsg("A határ egy nem negatív szám legyen."); return; }
    if (!rule.channels.length) { setMsg("Válassz legalább egy csatornát."); return; }
    const r = await rpc(sb, "admin_rule_save", { p: { ...(rule.id ? { id: rule.id } : {}), metric: rule.metric, op: rule.op, threshold: th, window_min: Number(rule.window_min), channels: rule.channels } });
    if (r.error) { setMsg(r.error.message); return; }
    toast(rule.id ? "Szabály módosítva" : "Szabály mentve"); setRule(blank); reload();
  };
  const del = async (r: D) => { if (!confirm(`Törlöd ezt a szabályt? (${METRIC[r.metric] || r.metric} ${r.op} ${fmt(n(r.threshold))})`)) return; const x = await rpc(sb, "admin_rule_save", { p: { delete: r.id } }); if (x.error) return toast("Nem sikerült: " + x.error.message); toast("Szabály törölve"); reload(); };
  const toggle = async (r: D) => { const x = await rpc(sb, "admin_rule_save", { p: { toggle: r.id, on: !r.on_ } }); if (x.error) return toast("Nem sikerült: " + x.error.message); reload(); };
  return (
    <Card className="s5" icon={P.bolt} title="Riasztási szabályok" sub="5 percenként ellenőrizzük. Ha egy szám átlépi a határt, a kiválasztott csatornán jön jelzés (szabályonként legfeljebb óránként egyszer). A Telegramhoz és az e-mailhez a Kapcsolatok oldalon kell a kulcs.">
      <ul className="rules">{((d.rules || []) as D[]).map((r) => <li key={r.id} className={r.on_ ? "" : "off"}>
        <span>{METRIC[r.metric] || r.metric} {r.op} {fmt(n(r.threshold))} <small>/ {r.window_min < 60 ? r.window_min + " perc" : fmt(r.window_min / 60, 1) + " óra"} · {((r.channels || ["push"]) as string[]).map((c) => CHN[c] || c).join(", ")}{r.last_fired ? ` · utoljára ${ago(r.last_fired)}` : ""}</small></span>
        <span className="adm-row" style={{ flexWrap: "nowrap" }}><button className={"sw" + (r.on_ ? " on" : "")} role="switch" aria-checked={!!r.on_} aria-label="Szabály be/ki" onClick={() => toggle(r)}><i /></button>
          <button className="lnk" onClick={() => setRule({ id: r.id, metric: r.metric, op: r.op, threshold: String(r.threshold), window_min: String(r.window_min), channels: r.channels || ["push"] })}>szerkesztés</button>
          <button className="lnk" onClick={() => del(r)}>törlés</button></span></li>)}</ul>
      <form className="rule-f" onSubmit={save}>
        <select className="adm-in sm" value={rule.metric} onChange={(x) => setRule({ ...rule, metric: x.target.value })} aria-label="Mutató">{Object.entries(METRIC).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <select className="adm-in sm" value={rule.op} onChange={(x) => setRule({ ...rule, op: x.target.value })} aria-label="Feltétel"><option value=">">több mint</option><option value="<">kevesebb mint</option></select>
        <input className="adm-in sm" inputMode="decimal" value={rule.threshold} onChange={(x) => setRule({ ...rule, threshold: x.target.value })} aria-label="Határ" />
        <select className="adm-in sm" value={rule.window_min} onChange={(x) => setRule({ ...rule, window_min: x.target.value })} aria-label="Ablak">{[5, 15, 30, 60, 180, 1440, 4320, 10080].map((m) => <option key={m} value={m}>{m < 60 ? m + " perc" : m < 1440 ? m / 60 + " óra" : m / 1440 + " nap"}</option>)}</select>
        <span className="pick-list chn">{Object.entries(CHN).map(([k, l]) => <button type="button" key={k} aria-pressed={rule.channels.includes(k)} onClick={() => setRule({ ...rule, channels: rule.channels.includes(k) ? rule.channels.filter((c) => c !== k) : [...rule.channels, k] })}>{l}</button>)}</span>
        <button className="adm-ibtn gold sm">{I(rule.id ? P.check : P.plus)}{rule.id ? "Mentés" : "Hozzáadás"}</button>
        {rule.id && <button type="button" className="lnk" onClick={() => setRule(blank)}>Mégse</button>}
      </form>
      {msg && <p className="note down">{msg}</p>}
    </Card>
  );
}

/* Vercel: the last deployments' state, when an API token was given on the Kapcsolatok page */
function VercelBuilds({ v }: { v: D | null }) {
  if (!v) return null;
  if (!v.vercel) return v.vercel === undefined && v.keys ? <p className="note">A Vercel build-állapotához adj meg egy Vercel API-tokent a Kapcsolatok oldalon (Vercel kártya).</p> : null;
  if (v.vercel.error) return <p className="note down">Vercel: {v.vercel.error}</p>;
  const S: Record<string, [string, string]> = { READY: ["kész", "good"], ERROR: ["hiba", "bad"], BUILDING: ["épül", "gold"], QUEUED: ["sorban", "gold"], CANCELED: ["megszakítva", ""], INITIALIZING: ["indul", "gold"] };
  return (
    <><h4 style={{ margin: "12px 0 6px" }}>Vercel-telepítések</h4>
      <ul className="rels">{(v.vercel as D[]).map((x) => <li key={x.id}><code>{x.sha || "–"}</code><span>{x.msg || x.target}</span><small>{dt(x.at)}</small><span className={"chip " + (S[x.state]?.[1] || "")}>{S[x.state]?.[0] || x.state}{x.target === "production" ? " · éles" : ""}</span></li>)}</ul></>
  );
}

/* e-mail delivery with the rates that matter: bounces and spam marks against what went out */
function EmailCard({ rows }: { rows: D[] }) {
  const v = (k: string) => n(rows.find((x) => x.type === k)?.n);
  const sent = Math.max(v("email.sent"), v("email.delivered")), bounce = sent ? v("email.bounced") / sent : 0, spam = sent ? v("email.complained") / sent : 0;
  return (
    <Card className="s6" icon={P.mail} title="E-mail-kézbesítés" sub="A Resend eseményei (30 nap): kézbesítve, visszapattant, spamnek jelölve, megnyitva. Visszapattanás 2%, spamjelölés 0,1% fölött a levelek a spambe kerülhetnek; 5% fölött jelzés jön. Ehhez egyszer be kell állítani a Resend webhookját (Kapcsolatok)."
      right={sent ? <span className={"chip " + (bounce > 0.05 || spam > 0.003 ? "bad" : bounce > 0.02 || spam > 0.001 ? "warn" : "good")}>visszapattan {pct(v("email.bounced"), sent)} · spam {pct(v("email.complained"), sent, 2)}</span> : undefined}>
      <BarList items={rows.map((x) => ({ k: x.type, n: n(x.n) }))} fmtK={(k) => ({ "email.sent": "Elküldve", "email.delivered": "Kézbesítve", "email.bounced": "Visszapattant", "email.complained": "Spamnek jelölte", "email.opened": "Megnyitva", "email.clicked": "Kattintott", "email.delivery_delayed": "Késik" } as D)[k] || k}
        empty="Még nincs esemény: állítsd be a webhookot a Kapcsolatok oldalon." />
      {sent > 0 && <p className="note">Megnyitási arány: {pct(v("email.opened"), v("email.delivered") || sent)}</p>}
    </Card>
  );
}

/* API limits and the AI's use: Programmable Search 100 a day, YouTube's daily units (estimated from the runs), the
   AI's calls against the daily limit and its tokens; the cost estimate uses the price per million tokens she enters */
function Quotas({ d }: { d: D }) {
  const qd = d.quota || {};
  const [price, setPrice] = useState<{ i: string; o: string }>({ i: "", o: "" });
  useEffect(() => { try { setPrice(JSON.parse(localStorage.getItem("inkage.admin.aiprice") || '{"i":"","o":""}')); } catch {} }, []);
  const setP = (p: { i: string; o: string }) => { setPrice(p); try { localStorage.setItem("inkage.admin.aiprice", JSON.stringify(p)); } catch {} };
  const pi = Number(price.i.replace(",", ".")), po = Number(price.o.replace(",", "."));
  const cost = pi > 0 || po > 0 ? (n(qd.ai_in_30d) / 1e6) * (pi || 0) + (n(qd.ai_tokens_30d) / 1e6) * (po || 0) : null;
  return (
    <Card className="s6" icon={P.target} title="Keretek és MI-használat" sub="A napi ingyenes keretek közelsége, és mennyit használt az MI. A YouTube napi 10 000 egységet ad; egy lehúzás nagyjából 10–50 egység, ezért csak a lehúzások számát mutatjuk.">
      <dl className="kv">
        <dt>Programmable Search ma</dt><dd><b className={n(qd.cse_today) >= 90 ? "down" : ""}>{fmt(qd.cse_today)}</b> / 100 keresés</dd>
        <dt>YouTube-lehúzás ma</dt><dd>{fmt(qd.youtube_syncs_today)} (kb. {fmt(n(qd.youtube_syncs_today) * 30)} / 10 000 egység)</dd>
        <dt>MI-hívás ma</dt><dd><b className={n(qd.ai_today) >= AI_DAILY * 0.9 ? "down" : ""}>{fmt(qd.ai_today)}</b> / {AI_DAILY} (minden oldal együtt)</dd>
        <dt>MI-hívás 30 nap</dt><dd>{fmt(d.ai_calls_30d)}</dd>
        <dt>Tokenek 30 nap</dt><dd>{fmt(qd.ai_in_30d)} be · {fmt(qd.ai_tokens_30d)} ki</dd>
        <dt>Költségbecslés</dt><dd>{cost != null ? <b>~{fmt(cost, 2)} $ / 30 nap</b> : <span className="mut">add meg az árat lent</span>}</dd>
      </dl>
      <div className="rule-f" style={{ marginTop: 8 }}>
        <label className="lf sm"><span>$ / 1M bemenő token</span><input className="adm-in sm" inputMode="decimal" value={price.i} onChange={(e) => setP({ ...price, i: e.target.value })} /></label>
        <label className="lf sm"><span>$ / 1M kimenő token</span><input className="adm-in sm" inputMode="decimal" value={price.o} onChange={(e) => setP({ ...price, o: e.target.value })} /></label>
      </div>
      <p className="note">Az árat a szolgáltató árlistájáról írd be (ebben a böngészőben marad).</p>
    </Card>
  );
}

/* push delivery: the devices, when each last received one, failures in a row */
function PushHealth({ p }: { p: D }) {
  const dev = (p.devices || []) as D[];
  const ua = (u: string) => /iPhone/.test(u) ? "iPhone" : /iPad/.test(u) ? "iPad" : /Android/.test(u) ? "Android" : /Mac OS/.test(u) ? "Mac" : /Windows/.test(u) ? "Windows" : u ? u.slice(0, 30) : "eszköz";
  return (
    <Card className="s6" icon={P.bell} title="Push-kézbesítés" sub="Az értesítésre feliratkozott eszközök: mikor kaptak utoljára, és hányszor nem sikerült egymás után (ötödik hibánál az eszköz kikerül).">
      {dev.length ? <ul className="signins">{dev.map((x, i) => <li key={i}><b>{ua(x.ua)}</b>{n(x.fails) > 0 ? <span className="chip bad">{fmt(x.fails)} sikertelen</span> : <span className="chip good">rendben</span>}<span className="mut">utoljára kapott: {x.last_ok ? ago(x.last_ok) : "még nem"}</span></li>)}</ul>
        : <Empty t="Egy eszköz sincs feliratkozva. Kapcsold be a Rendszer oldalon." />}
      <p className="note">Az elmúlt 7 napban {fmt(p.sent_7d)} jelzés ment ki.</p>
    </Card>
  );
}

function ErrorSheet({ x, close, setState, reload }: { x: D; close: () => void; setState: (fp: string, s: string, note?: string) => void; reload: () => void }) {
  const sb = useMemo(() => supabaseBrowser(), []);
  /* the sessions of this error, newest first: the steps before the error in any of them */
  const sess: { s: string; t: string }[] = useMemo(() => { const ss = (x.sessions || []) as string[], tt = (x.times || []) as string[]; const seen = new Set<string>(); return ss.map((s, i) => ({ s, t: tt[i] })).filter((y) => y.s && !seen.has(y.s) && (seen.add(y.s), true)); }, [x]);
  const [si, setSi] = useState(0);
  const cur = sess[si] || { s: x.last_session, t: x.last };
  const crumbs = useRpc("admin_breadcrumbs", { p_session: cur.s, p_before: cur.t }, [x.fp, cur.s]);
  const [ai, setAi] = useState<string>(x.ai || ""); const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string>(x.note || ""); const [savedNote, setSavedNote] = useState<string>(x.note || "");
  const analyse = async () => {
    setBusy(true);
    const r = MOCK ? { ok: true, json: { text: "1. Ok: az Android-app Google-belépése a scopes beállítás miatt nem indul. 2. Ellenőrzés: Android-eszközön belépés. 3. Javítás: a plugin hívásából a scopes kivétele. 4. Sürgős." } }
      : await api("/api/admin/ai", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode: "error", data: { hiba: x.msg, esemeny: x.name, hol: x.where_, oldal: x.path, emberek: x.people, esetek: x.n, elso: x.first, utolso: x.last, bongeszok: x.uas, lepesek: crumbs.d } }) });
    setBusy(false);
    const t = r.ok ? r.json?.text || "" : r.json?.error || "Nem sikerült.";
    setAi(t);
    /* kept: the next time the sheet opens, the analysis is already there */
    if (r.ok && t) { await rpc(sb, "admin_error_ai", { p_fp: x.fp, p_text: t }); reload(); }
  };
  const saveNote = async () => { const r = await rpc(sb, "admin_error_state", { p_fp: x.fp, p_state: x.state || "open", p_note: note.trim() }); if (r.error) return toast("Nem sikerült: " + r.error.message); setSavedNote(note.trim()); toast("Jegyzet mentve"); reload(); };
  return (
    <Layer>
      <div className="scrim" onClick={close} />
      <aside className="drawer wide" role="dialog" aria-label="Hibacsoport">
        <div className="c-h"><div><div><span className="eyebrow">{EV[x.name] || x.name} · {fmt(x.people)} ember · {fmt(x.n)} eset</span><h2 style={{ fontSize: 18, marginTop: 6 }}>{human(x.msg)}</h2></div></div><button className="adm-ibtn" onClick={close}>Bezárás</button></div>
        <dl className="kv"><dt>Eredeti üzenet</dt><dd style={{ wordBreak: "break-word" }}>{x.msg || "–"}</dd><dt>Hol</dt><dd>{x.where_ || "–"} {x.path ? "· " + x.path : ""}</dd><dt>Először</dt><dd>{dt(x.first)}</dd><dt>Utoljára</dt><dd>{dt(x.last)}</dd>
          <dt>Böngészők</dt><dd>{((x.uas || []) as string[]).filter((u) => u !== "?").slice(0, 3).join(" · ") || "nem ismert"}</dd></dl>
        <h3>Jegyzet</h3>
        <textarea className="adm-in" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Pl. „javítva a 1.0.3-ban”, „csak régi Androidon”…" maxLength={1000} />
        {note.trim() !== savedNote && <div className="adm-row"><button className="adm-ibtn sm gold" onClick={saveNote}>Jegyzet mentése</button></div>}
        <h3>Mi történt előtte</h3>
        {sess.length > 1 && <div className="adm-seg sm sess-pick">{sess.slice(0, 6).map((y, i) => <button key={y.s + i} aria-pressed={si === i} onClick={() => setSi(i)}>{i === 0 ? "Utolsó" : ago(y.t)}</button>)}</div>}
        {crumbs.e ? <StateErr msg={crumbs.e} retry={crumbs.load} /> : !crumbs.d ? <div className="skel" style={{ height: 100 }} /> : (crumbs.d as D[]).length ? <ol className="tline">{(crumbs.d as D[]).map((c, i) => <li key={i} className={/error|failed/.test(c.name) ? "bad" : ""}><time>{new Date(c.created_at).toLocaleTimeString("hu-HU")}</time><span>{EV[c.name] || c.name}{c.detail ? " · " + String(c.detail).slice(0, 60) : ""}</span></li>)}</ol> : <p className="note">Nincs lépés ehhez a látogatáshoz.</p>}
        <div className="adm-row"><button className="adm-ibtn gold" onClick={analyse} disabled={busy}>{busy ? "Elemzés…" : ai ? "✦ MI: elemzés újra" : "✦ MI: mi lehet az oka?"}</button>{x.ai_at && <span className="note">mentett elemzés: {ago(x.ai_at)}</span>}</div>
        {ai && <div className="ai-t">{ai.split("\n").map((l, i) => <p key={i}>{l}</p>)}</div>}
        <div className="adm-row">{x.state !== "resolved" && <button className="adm-ibtn" onClick={() => setState(x.fp, "resolved", note.trim() || undefined)}>✓ Megoldva</button>}{x.state !== "ignored" && <button className="adm-ibtn" onClick={() => setState(x.fp, "ignored", note.trim() || undefined)}>Figyelmen kívül</button>}{x.state !== "open" && <button className="adm-ibtn" onClick={() => setState(x.fp, "open")}>Újranyitás</button>}</div>
      </aside>
    </Layer>
  );
}

/* ---------- Adatminőség: on which days each source was read, and what the counting leaves out ---------- */
const SRCN: Record<string, string> = { tiktok: "TikTok", instagram: "Instagram", facebook: "Facebook", pinterest: "Pinterest", linkedin: "LinkedIn", youtube: "YouTube", gsc: "Google Search Console", gsc_index: "Google-indexelés",
  apple: "App Store", google: "Google Play", bing: "Bing", seo: "SEO-bejárás", watch: "Napi figyelés", aivis: "MI-láthatóság", cwv: "Oldalsebesség", competitors: "Versenytársak", mentions: "Említések", kw_ideas: "Kulcsszóötletek", cse: "Programmable Search" };
const REASON: Record<string, string> = { "crawler pair": "keresőrobot-pár", "app flash": "1 eseményes appvillanás", "automated test": "automata teszt", "owner review": "saját ellenőrzés", "scripted run": "szkriptes futás",
  "pre-launch test": "indulás előtti teszt", "old /nev page": "régi /nev oldal", "old vercel address": "régi Vercel-cím" };
function DataQuality() {
  const { d } = useRpc("admin_data_quality", { p_days: 30 }, []);
  const x = (d as D) || null;
  const src: D[] = x?.sources || [];
  return (
    <Card className="s12" icon={P.check} title="Adatminőség" sub="Az utolsó 30 nap: forrásonként hány napon sikerült legalább egy lehúzás, mely napok maradtak ki (az első lehúzástól számolva), és mit hagy ki a számolás. A robotokat, a teszteket és a saját eszközeidet a rendszer óránként jelöli meg; ezek sehol nem számítanak bele a számokba.">
      {!x ? <div className="skel" style={{ height: 160 }} /> : <>
        <div className="mini-stats">
          <div className="mini"><span>Valódi látogatás</span><b>{fmt(n(x.sessions_real))}</b><small>az összes {fmt(n(x.sessions_all))} munkamenetből</small></div>
          <div className="mini"><span>Robot és teszt</span><b>{fmt(n(x.bots))}</b><small>{Object.entries((x.bot_reasons || {}) as Record<string, number>).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${REASON[k] || k}: ${fmt(v)}`).join(" · ")}</small></div>
          <div className="mini"><span>Saját eszköz</span><b>{fmt(n(x.own))}</b><small>a te látogatásaid, kizárva</small></div>
          <div className="mini"><span>Hiányos forrás</span><b>{fmt(src.filter((s) => (s.gaps || []).length > 0).length)}</b><small>{src.length} forrásból van kimaradt nap</small></div>
        </div>
        <Tbl name="adatminoseg" rows={src.map((s) => ({ ...s, ngaps: (s.gaps || []).length }))} empty="Még nem futott lehúzás." cols={[
          { k: "source", l: "Forrás", r: (r) => <b>{SRCN[r.source] || r.source}</b> },
          { k: "ok_days", l: "Sikeres nap", num: true, r: (r) => fmt(r.ok_days) },
          { k: "ngaps", l: "Kimaradt nap", num: true, r: (r) => (r.ngaps ? <span className={"chip " + (r.ngaps > 2 ? "bad" : "warn")} title={(r.gaps as string[]).join(", ")}>{fmt(r.ngaps)}</span> : <span className="chip good">0</span>) },
          { k: "last_ok", l: "Utolsó siker", r: (r) => (r.last_ok ? ago(r.last_ok) : <span className="chip bad">még soha</span>) },
          { k: "fails", l: "Hiba (30 nap)", num: true, r: (r) => fmt(r.fails) },
          { k: "gaps", l: "Mely napok", r: (r) => <span className="cellwrap mut">{(r.gaps as string[]).slice(-6).map((g) => g.slice(5).replace("-", ".")).join(", ")}{(r.gaps as string[]).length > 6 ? " …" : ""}</span> },
        ]} />
      </>}
    </Card>
  );
}
