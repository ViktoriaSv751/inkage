"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { ACC, BarList, Columns, CountUp, Delta, Empty, Sankey, Spark, StackedColumns, TrendChart, fmt, pct } from "../charts";
import { HourClock, Logo } from "../wow";
import { Band, CH, Card, DOW, FreshRow, Kpi, Layer, Mini, P, PF, SOC, Tbl, ago, barCell, big, ch, chCol, lang, n, pctCell, periodName, periodWords, rpc, secs, type D, useBlockRpc, useFlt, useRpc , series } from "../shared";
import { KnownShare } from "./home";
import { More } from "../extra";

/* visits without a known source: the direct ones, and the Android app's opens (they carry none either) */
const NOSRC = new Set(["közvetlen", "androidapp"]);

/* the channels the classification tells apart besides the ones the shared list names (X, Threads, Reddit, messengers,
   e-mail clients, Google Play, Google Ads, Bing on its own) */
Object.assign(CH, { x: "X (Twitter)", threads: "Threads", reddit: "Reddit", whatsapp: "WhatsApp", messenger: "Messenger", telegram: "Telegram", bing: "Bing", play: "Google Play", ads: "Google Ads", ismeretlen: "Nem párosítható" });

/* the period of the dashboard, for the page's own database calls */
export const per = (d: D) => ({ p_days: n(d.days) || 30, p_from: d.filter?.from ? d.from : null, p_to: d.filter?.from ? d.to : null });
const PFL: Record<string, string> = { web: "Weboldal", android: "Android-app (becslés)", ios: "iPhone-app", ismeretlen: "Nem párosítható" };
const SIGNUP_NOTE = "Becslés: a regisztrációt az időben legközelebbi, azonos nyelvű névtelen látogatáshoz kötjük (a mérés fiókot nem tárol). Az iPhone-app nem küld adatot, ezért az ottani regisztrációk nem párosíthatók.";

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
  const hours = Array.from({ length: 24 }, (_, h) => ({ k: String(h), v: n((d.hours || []).find((x: D) => x.h === h)?.n), tip: `${h}:00–${h}:59` }));
  const bestH = [...hours].sort((a, b) => b.v - a.v)[0];
  const kn = T.known || {}, identified = n(kn.now), total = n(kn.all) || n(N.sessions);
  const topK = chans.filter((c) => !NOSRC.has(c.k))[0];
  const [open, setOpen] = useState<string | null>(null); const [tbl, setTbl] = useState(false);
  const du = T.duration || {}, dup = T.duration_prev || {};
  const pfs: D[] = T.platforms || [], pfp: D[] = T.platforms_prev || [];
  const su = T.signups || {};
  const pfRows = ((T.platform_path || []) as D[]).filter((r) => n(r.views) || n(r.sessions) || n(r.clicks));
  const wk = Array.from({ length: 7 }, (_, i) => ({ k: DOW[i + 1].slice(0, 3), v: n((d.weekdays || []).find((x: D) => n(x.w) === i + 1)?.n), tip: DOW[i + 1] }));
  return (
    <div className="g">
      <FreshRow srcs={["events", ...SOC]} />
      <Band plain label={`Látogatás ${periodName(d)}`} value={n(N.sessions)} now={n(N.sessions)} prev={n(PV.sessions)} sentence={<>A forrás a látogatás első oldaláé (utm-jelölés, hivatkozó oldal), és a látogatás végéig megmarad. Látogatásokon átívelő követés nincs: a mérés névtelen, két látogatást nem kötünk össze. A látogatások <b>{pct(identified, total)}</b>-ánál tudjuk, honnan jöttek{topK ? <>; a legerősebb azonosított csatorna: <b>{ch(topK.k)}</b> ({fmt(topK.sessions)} látogatás, {pct(n(topK.scored), n(topK.sessions))} előnézetig)</> : ""}.</>} side={<KnownShare chans={chans} total={n(N.sessions)} size={140} onPick={(k) => set({ ch: k })} />} />
      <section className="s12"><ChCards chans={chans} trend={d.channel_trend || []} onPick={(k) => setOpen(k)} /></section>
      <Kpi kind="own" to="funnel" tone="butter" className="s3" icon={P.doc} l="Weboldalt látta" v={<CountUp v={n(N.landing)} />} now={n(N.landing)} prev={n(PV.landing)} sub={<span>{pct(n(N.landing), n(N.sessions))} a látogatásokból · az Android-app nyitóoldala is ide számít</span>} />
      <Kpi kind="own" to="@next" tone="pink" className="s3" icon={P.target} l="Ismert forrásból" v={pct(identified, total)} now={total ? identified / total : 0} prev={n(kn.prev_all) ? n(kn.prev) / n(kn.prev_all) : 0} sub={<span>{fmt(identified)} látogatásnál · előtte {pct(n(kn.prev), n(kn.prev_all))}</span>} />
      {/* the median, not the mean: a tab left open for days made the "average visit" 51 minutes while the middle one was 15 seconds */}
      <Kpi kind="own" to="@next" tone="sky" className="s3" icon={P.clock} l="Látogatás hossza (medián)" v={secs(du.median ?? d.session_len?.median_sec)} now={n(du.median)} prev={d.prev_partial ? undefined : n(dup.median)} sub={<span>75%-uk {secs(du.p75 ?? d.session_len?.p75_sec)} alatt · átlag {secs(du.mean_capped ?? du.mean)} (30 percnél hosszabb látogatás 30 percnek számít)</span>} title="A több eseményes látogatások középső hossza. Az átlagot a napokig nyitva hagyott fülek felhúznák, ezért ott egy látogatás legfeljebb 30 percnek számít." />
      <Kpi spark={series(d, "signups")} kind="est" to="users" tone="peach" className="s3" icon={P.user} l="Regisztráció (becslés)" v={fmt(su.n)} now={n(su.n)} prev={n(su.prev)} sub={<span>{fmt(su.matched)} párosítva látogatáshoz</span>} title={SIGNUP_NOTE} />

      <Card className="s12" icon={P.eye} title="Weboldal és Android-app" sub="A weboldal 2026. okt. 23. óta minden eseménnyel elküldi, hogy weboldal; ami ezt nem küldi, az a Google Play-es Android-app (ez az /app oldalon nyílik). Előtte becslés volt. Az iPhone-app még nincs kint; ha kijön, és nem küld semmit, ide, az Android-apphoz számítana.">
        {pfs.length ? <div className="mini-stats" style={{ gridTemplateColumns: `repeat(${Math.min(4, pfs.length + 1)},1fr)` }}>
          {pfs.map((x) => { const pv = n(pfp.find((y) => y.k === x.k)?.n); return <Mini key={x.k} l={PFL[x.k] || x.k} v={fmt(x.n)} sub={<>{pct(n(x.scored), n(x.n))} előnézetig · <Delta now={n(x.n)} prev={pv} /></>} />; })}
          <Mini l="iPhone-app" v="–" sub="nem küld adatot (App Store-szabály)" />
        </div> : <Empty t="Még nincs látogatás ebben az időszakban." />}
      </Card>

      <Card className="s12" icon={P.layers} title="Látogatások csatornánként, naponta" sub="Minden oszlop egy nap; a színek a csatornák. A szürke: forrás nélkül érkezett (beírta a címet, vagy appból jött)."
        right={<div className="adm-seg sm"><button aria-pressed={!tbl} onClick={() => setTbl(false)}>Grafikon</button><button aria-pressed={tbl} onClick={() => setTbl(true)}>Táblázat</button></div>}
        foot={<div className="legend">{keys.map((k) => <span key={k}><i className="sq" style={{ background: chCol(k) }} />{ch(k)}</span>)}</div>}>
        {tbl ? <Tbl name="csatornak-naponta" rows={days.map((x: D) => ({ t: String(x.t).slice(0, 10), ...Object.fromEntries(keys.map((k) => [k, n(x.v[k])])), total: keys.reduce((s, k) => s + n(x.v[k]), 0) }))}
          cols={[{ k: "t", l: "Nap" }, ...keys.map((k) => ({ k, l: ch(k), num: true })), { k: "total", l: "Összesen", num: true, r: (r: D) => <b>{fmt(r.total)}</b> }]} />
          : <StackedColumns days={days} keys={keys} label={ch} color={chCol} />}
      </Card>

      <Card className="s12" icon={P.funnel} title="Az út csatornánként" sub="Balról jobbra: honnan jöttek, megnyitották-e az appot, feltöltöttek-e bőrfotót vagy kihagyták, megkapták-e az előnézetet, megnézték-e 50 év múlva, és megosztották-e. A kihagyók is a folyamban maradnak.">
        <div className="ph-hide"><SankeyFlow chans={(T.flow as D[]) || chans} /></div>
        {/* on a phone the flow reads as a list: each channel and how far its visitors get */}
        <ul className="jlist ph-only">{(((T.flow as D[]) || chans) as D[]).filter((c) => n(c.sessions) > 0).map((c) => (
          <li key={c.k} onClick={() => set({ ch: c.k })}>
            <div className="jl-h"><Logo k={c.k} size={30} /><b>{ch(c.k)}</b><em>{fmt(c.sessions)}</em></div>
            <div className="jl-steps">{([["app", "App"], ["scored", "Előnézet"], ["revealed", "50 év múlva"], ["shared", "Megosztás"]] as const).map(([k, l]) => (
              <span key={k}><i style={{ width: `${Math.max(3, (n(c[k]) / Math.max(1, n(c.sessions))) * 100)}%`, background: chCol(c.k) }} /><small>{l}</small><b>{pct(n(c[k]), n(c.sessions))}</b></span>
            ))}</div>
          </li>
        ))}</ul>
      </Card>

      {pfRows.length > 0 && <Card className="s12" icon={P.social} title="A posztoktól a fiókig, platformonként" sub={<>Balra a platform saját száma: a posztjaid megtekintései, amennyivel az időszakban nőttek (nem az élettartam-összeg); a Google-nél a keresési megjelenés és kattintás a Google napi összesítőjéből (a mai, félkész nappal; a Google nem tud a csatorna- és nyelvszűrőről, ezért az ő száma szűrve sem változik). Jobbra a mi mérésünk: rövid link-kattintás (a link posztja vagy utm-forrása szerint), látogatás, előnézet, regisztráció. {SIGNUP_NOTE}</>} src={[...SOC, "gsc"]}>
        <Tbl name="platform-ut" rows={pfRows} csv cols={[
          { k: "k", l: "Platform", r: (r) => <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}><Logo k={r.k} size={22} /><b>{PF[r.k] || ch(r.k)}</b></span> },
          { k: "views", l: "Megtekintés / megjelenés", num: true, r: (r) => (r.views == null ? <span className="mut">–</span> : big(r.views)) },
          { k: "clicks", l: "Kattintás", num: true, r: (r) => <>{fmt(r.clicks)} {n(r.views) ? <small className="mut">{pct(n(r.clicks), n(r.views), 2)}</small> : null}</> },
          { k: "sessions", l: "Látogatás", num: true, r: (r) => <b>{fmt(r.sessions)}</b> }, { k: "organic", l: "ebből link nélkül", num: true, r: (r) => <span className="mut">{fmt(r.organic)}</span> },
          { k: "scored", l: "Előnézet", num: true, r: (r) => <>{fmt(r.scored)} {pctCell(n(r.scored), n(r.sessions))}</> },
          { k: "signups", l: "Regisztráció", num: true, r: (r) => <>{fmt(r.signups)} {pctCell(n(r.signups), n(r.sessions))}</> },
        ]} />
      </Card>}

      <Card className="s12" icon={P.globe} title="Csatornák: a teljes út" right={cb.ctl} sub={<>{cb.own ? <>Ennek a blokknak a saját időszaka: {periodWords(cb.p)}. </> : null}Honnan jött, eljutott-e az előnézetig, megnézte-e 50 év múlva, megosztott-e, és hány regisztrációt hozott (becslés). Mellette a változás az előző ugyanilyen hosszú időszakhoz. Kattints egy sorra: a csatorna saját oldala. {SIGNUP_NOTE}</>}>
        {cb.own && !cb.q.d ? <div className="skel" style={{ height: 200 }} /> : <Tbl name="csatornak" rows={cChans} onRow={(r) => setOpen(r.k)} cols={[
          { k: "k", l: "Csatorna", r: (r) => <span className="chip" style={{ background: "transparent", padding: 0, color: "var(--a-fg)", fontSize: 13 }}><i className="dot" style={{ background: chCol(r.k), width: 9, height: 9 }} />{ch(r.k)}</span> },
          { k: "sessions", l: "Látogatás", num: true, r: (r) => <>{barCell(n(r.sessions), cMax)} {r.p_sessions != null && <Delta now={n(r.sessions)} prev={n(r.p_sessions)} />}</> },
          { k: "tr", l: "Trend", r: (r) => { if (cb.own) return <span className="mut" title="A trend a fölső időszakot mutatja">–</span>; const sp = (d.channel_trend || []).filter((x: D) => x.k === r.k).map((x: D) => n(x.n)); return sp.length > 1 ? <span style={{ display: "inline-block", width: 90 }}><Spark values={sp} h={24} color={chCol(r.k)} /></span> : <span className="mut">–</span>; } },
          { k: "app", l: "App", num: true, r: (r) => <>{fmt(r.app)} {pctCell(n(r.app), n(r.sessions))}</> },
          { k: "scored", l: "Előnézet", num: true, r: (r) => <>{fmt(r.scored)} {pctCell(n(r.scored), n(r.sessions))}</> },
          { k: "revealed", l: "50 év múlva", num: true, r: (r) => <>{fmt(r.revealed)} {pctCell(n(r.revealed), n(r.sessions))}</> },
          { k: "shared", l: "Megosztott", num: true, r: (r) => <>{fmt(r.shared)} {pctCell(n(r.shared), n(r.sessions))}</> },
          { k: "signups", l: "Regisztráció", num: true, r: (r) => <>{fmt(r.signups)} {r.p_signups != null && <Delta now={n(r.signups)} prev={n(r.p_signups)} />}</> },
        ]} />}
      </Card>

      <Card className="s12" icon={P.target} title="Kampányok és videók (utm)" sub="A linkek utm_source / utm_campaign / utm_content jelölése szerint. A rövid linkek (inkage.app/go/12) ezt maguktól beállítják; ilyenkor a poszt címe is látszik.">
        <Tbl rows={(T.campaigns || d.campaigns || []) as D[]} empty="Még senki nem jött jelölt linkről. Hozz létre egy rövid linket a Linkek oldalon, és tedd a videó leírásába." cols={[
          { k: "source", l: "Forrás", r: (r) => <b>{ch(r.source)}</b> }, { k: "medium", l: "Típus" }, { k: "campaign", l: "Kampány" },
          { k: "content", l: "Videó / tartalom", r: (r) => <span className="cellwrap">{r.content}{r.post_title ? <><br /><span className="mut">{PF[r.post_platform] ? PF[r.post_platform] + ": " : ""}{String(r.post_title).slice(0, 60)}</span></> : null}</span> },
          { k: "sessions", l: "Látogatás", num: true, r: (r) => fmt(r.sessions) },
          { k: "scored", l: "Előnézet", num: true, r: (r) => <>{fmt(r.scored)} {pctCell(n(r.scored), n(r.sessions))}</> },
          { k: "revealed", l: "50 év múlva", num: true, r: (r) => <>{fmt(r.revealed)} {pctCell(n(r.revealed), n(r.sessions))}</> },
          { k: "shared", l: "Megosztott", num: true, r: (r) => fmt(r.shared) },
          { k: "signups", l: "Regisztráció", num: true, r: (r) => (r.signups == null ? "–" : fmt(r.signups)) },
        ]} />
      </Card>

      <More label="Részletek: hivatkozók, ref-kódok, belépő oldalak, napszak, a hét napjai, gombok, nyelv">
      <Card className="s4" icon={P.links} title="Hivatkozó oldalak" sub="Melyik oldalról kattintottak át."><ul className="refs">{((d.referrers || []) as D[]).slice(0, 8).map((r) => <li key={r.k}><Fav host={r.k} /><span>{r.k}</span><b>{fmt(r.n)}</b><small>{fmt(r.scored)} előnézet</small></li>)}{!(d.referrers || []).length && <li className="note">Még nincs hivatkozó oldal.</li>}</ul></Card>
      <Card className="s4" icon={P.doc} title="Belépő oldal" sub="Az első oldal, amit láttak."><BarList items={(d.landings || []).map((r: D) => ({ k: r.k, n: n(r.n), sub: `${fmt(r.scored)} előnézet` }))} /></Card>
      <Card className="s4" icon={P.eye} title="Legnézettebb oldalak" sub="Weboldal-megtekintések (cikkek is)."><BarList items={(d.pages || []).map((r: D) => ({ k: r.k === "start" ? "/app" : r.k || "/", n: n(r.n) }))} /></Card>

      <Card className="s8 napszak" icon={P.clock} title="Napszak" sub="Mikor kezdik a látogatást (budapesti idő). Vidd az egeret egy órára." right={<span className="chip gold">Csúcs: {bestH.k}:00</span>}>
        <div className="clockrow"><HourClock hours={hours.map((x) => ({ h: Number(x.k), n: x.v }))} /><div style={{ flex: 1, minWidth: 0 }}><Columns data={hours} hiK={bestH.k} height={200} /></div></div>
      </Card>
      <Card className="s4" icon={P.bolt} title="Gombok a kezdőoldalon" sub="Melyik gombot választják a kezdőoldalon.">
        <BarList items={(d.ctas || []).map((r: D) => ({ k: r.k, n: n(r.n) }))} fmtK={(k) => ({ register: "Regisztráció", login: "Belépés", guest: "Kipróbálás fiók nélkül" } as D)[k] || k} empty="Még nincs kattintás." />
      </Card>
      <Card className="s4" icon={P.calendar} title="A hét napjai" sub="Melyik napon kezdik a látogatást."><Columns data={wk} height={170} hiK={[...wk].sort((a, b) => b.v - a.v)[0]?.k} /></Card>
      <Card className="s4" icon={P.links} title="Ajánló kódok (?ref=)" sub="A ?ref= paraméterrel érkezők (pl. bio-link, partner)."><BarList items={(d.refs || []).map((r: D) => ({ k: r.k, n: n(r.n), sub: `${fmt(r.scored)} előnézet` }))} empty="Még senki nem jött ?ref= jelöléssel." /></Card>
      <Card className="s4" icon={P.globe} title="Nyelv" sub="Az oldal nyelve a látogatásoknál. Kattints: szűrő erre a nyelvre."><BarList items={(d.langs || []).map((r: D) => ({ k: r.k, n: n(r.n), sub: `${fmt(r.scored)} előnézet` }))} fmtK={lang} max={10} onPick={(k) => set({ lang: k })} /></Card>
      <Card className="s12" icon={P.alert} title="Amit nem mérünk" sub="Szándékosan, az adatvédelem és az áruházi adatlapok miatt.">
        <p className="note">Az eszköz típusát (telefon / számítógép) a mérés nem küldi, ezért ez a kártya nem jelenik meg. Az alkalmazáson belüli böngészőt (TikTok, Instagram, Facebook) a weboldal okt. 22. óta elküldi: a csatornáknál ez is segít a forrást eltalálni. Az Android-app csak a platformját küldi, a Kapcsolatok oldalon bekapcsolható bővebb mérés nélkül semmi mást; az iPhone-app még nincs kint.</p>
      </Card>
      </More>
      {open && <ChannelDrawer k={open} d={d} close={() => setOpen(null)} filter={() => { set({ ch: open }); setOpen(null); }} />}
    </div>
  );
}

/* the channel cards with the change against the period before */
const ALLCH = ["google", "tiktok", "instagram", "facebook", "pinterest", "linkedin", "youtube", "ai", "email"];
function ChCards({ chans, trend, onPick }: { chans: D[]; trend: D[]; onPick: (k: string) => void }) {
  const tot = chans.reduce((s, c) => s + n(c.sessions), 0) || 1;
  const have = new Map(chans.map((c) => [c.k, c]));
  const list: D[] = [...chans.filter((c) => !NOSRC.has(c.k) && n(c.sessions) > 0), ...ALLCH.filter((k) => !n(have.get(k)?.sessions)).map((k) => ({ k, sessions: 0, scored: 0, p_sessions: have.get(k)?.p_sessions })), ...(have.get("androidapp") ? [have.get("androidapp") as D] : []), ...(have.get("közvetlen") ? [have.get("közvetlen") as D] : [])];
  return (
    <div className="chcards">
      {list.map((c) => {
        const sp = trend.filter((x) => x.k === c.k).map((x) => n(x.n)), zero = !n(c.sessions);
        return (
          <button key={c.k} className={"chcard" + (zero ? " zero" : "")} onClick={!zero ? () => onPick(c.k) : undefined}>
            <span className="chc-h"><Logo k={c.k} /><span className="chc-s">{zero ? "–" : pct(n(c.sessions), tot)}</span></span>
            <b>{ch(c.k)}</b>
            <span className="chc-v"><CountUp v={n(c.sessions)} /><small> látogatás</small>{c.p_sessions != null && (n(c.sessions) || n(c.p_sessions)) ? <span className="grw-d"><Delta now={n(c.sessions)} prev={n(c.p_sessions)} /></span> : null}</span>
            <span className="chc-c">{zero ? (n(c.p_sessions) ? `Előtte ${fmt(c.p_sessions)} látogatás` : "Még nem jött innen látogató") : `${pct(n(c.scored), n(c.sessions))} jut el a előnézetig${n(c.signups) ? ` · ${fmt(c.signups)} regisztráció` : ""}`}</span>
            {sp.length > 1 && !zero && <span className="chc-sp"><Spark values={sp} h={34} /></span>}
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
  const col = (k: string) => (k === "egyeb" ? "#6E6E75" : chCol(k));
  /* revealed: the ones who got a preview and the skippers who went through the intro questions */
  const revScored = Math.min(rev, scored), revSkip = Math.max(0, Math.min(skipped, rev - revScored));
  const layers = [
    groups.map((c) => ({ id: "c:" + c.k, l: c.k === "egyeb" ? "Egyéb" : ch(c.k), color: col(c.k) })),
    [{ id: "app", l: "Megnyitotta az appot", color: "rgba(244,242,236,.75)" }, { id: "web", l: "Csak a weboldal", color: "var(--a-s4)" }],
    [{ id: "cap", l: "Feltöltött egy bőrfotót", color: "rgba(244,242,236,.6)" }, { id: "skip", l: "Kihagyta a bőrfotót", color: "#9a8f7c" }, { id: "drop0", l: "Nem jutott el a bőrfotóig", color: "var(--a-s4)" }],
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
  useEffect(() => { rpc(sb, "admin_channel_detail", { p_ch: k, ...per(d), p_lang: f.lang || null }).then(({ data }) => setX(data || {})); }, [sb, k, d, f.lang]);
  const t: D = x?.totals || {}, pv: D = x?.prev || {}, camps: D[] = x?.campaigns || [];
  const t0 = camps.length ? Math.min(...camps.map((c) => new Date(c.first).getTime())) : 0, t1 = camps.length ? Math.max(...camps.map((c) => new Date(c.last).getTime()), t0 + 864e5) : 1;
  return (
    <Layer>
      <div className="scrim" onClick={close} />
      <aside className="drawer wide" role="dialog" aria-label={ch(k)}>
        <div className="c-h"><div><div><span className="eyebrow">Csatorna · {periodName(d)}</span><h2 style={{ fontSize: 22, marginTop: 6, display: "flex", gap: 10, alignItems: "center" }}><Logo k={k} size={30} />{ch(k)}</h2></div></div><button className="adm-ibtn" onClick={close}>Bezárás</button></div>
        {!x ? <div className="skel" style={{ height: 240 }} /> : <>
          <div className="mini-stats" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
            <Mini l="Látogatás" v={fmt(t.sessions)} sub={<Delta now={n(t.sessions)} prev={n(pv.sessions)} />} />
            <Mini l="Előnézet" v={fmt(t.scored)} sub={<>{pct(n(t.scored), n(t.sessions))} · <Delta now={n(t.scored)} prev={n(pv.scored)} /></>} />
            <Mini l="50 év múlva" v={fmt(t.revealed)} sub={pct(n(t.revealed), n(t.sessions))} />
            <Mini l="Regisztráció" v={fmt(t.signups)} sub={<>becslés · <Delta now={n(t.signups)} prev={n(pv.signups)} /></>} />
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
              { k: "created_at", l: "Megjelent", r: (r) => ago(r.created_at) }, { k: "views", l: "Megtekintés", num: true, r: (r) => big(r.views) },
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
