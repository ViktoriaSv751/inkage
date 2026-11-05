"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { BarList, Delta, Empty, Info, chColor, fmt, pct } from "../charts";
import { Logo } from "../wow";
import { Card, FreshRow, Loading, P, PF, SOC, Tbl, big, daysLabel, n, type D, useRpc } from "../shared";
import { usePhone } from "../phone";
import { Chg, Hero, Ring, Trio, type RingKind } from "../ink";
import { ReachMatrix } from "./social-wave";
import { PlatformFlow } from "./visual";

/* ---------- Platformok: the platforms side by side ----------
   Not who has the biggest numbers, but what each platform is worth: how many visitors, analyses and sign-ups its
   views bring (per 1000 views), and per post. A platform's "views" are what its posts gathered in the period (the
   posts of the period with all their views, older posts with what they gathered since); Pinterest and LinkedIn count
   impressions, so they are compared per 1000 impressions and never added to the others. */
const imp = (pf: string) => pf === "pinterest" || pf === "linkedin";
const per1k = (a: number, v: number) => (v > 0 ? (a * 1000) / v : null);
/* below this many visits a "per 1000" says nothing: one or two visits (perhaps her own test) would rank a platform first */
const MIN_VISITS = 10;
const noRate = "nem mérhető";
/* six looks from the four ring patterns: each platform keeps its own */
const LOOK: [RingKind, string][] = [["tick", ""], ["seg", ""], ["dots", ""], ["solid", ""], ["seg", "thin"], ["dots", "fine"]];

/* the same road on a phone: a drawn flow has no room for its words there */
function FlowList({ posts, leads }: { posts: D[]; leads: D[] }) {
  const rows = SOC.map((pf) => ({ pf, L: leads.find((l) => l.k === pf) || ({} as D) })).filter((x) => n(x.L.sessions) > 0).sort((a, b) => n(b.L.sessions) - n(a.L.sessions));
  if (!rows.length) return <Empty t="Ebben az időszakban még nem jött látogató a közösségi oldalakról: amint jön, itt látszik az útja a posztoktól a regisztrációig." />;
  return <ul className="jlist ir-flow">{rows.map(({ pf, L }) => {
    const top = posts.filter((p) => p.platform === pf && p.code && n(p.sessions_now) > 0).sort((a, b) => n(b.sessions_now) - n(a.sessions_now)).slice(0, 3);
    const used = top.reduce((t, p) => t + n(p.sessions_now), 0), rest = Math.max(0, n(L.sessions) - used);
    return <li key={pf}>
      <div className="jl-h"><Logo k={pf} size={30} /><b>{PF[pf]}</b><em>{fmt(L.sessions)}</em></div>
      <ul className="ir-flow-s">{top.map((p) => <li key={p.post_id}><span>{String(p.title || "Poszt").slice(0, 50)}</span><b>{fmt(p.sessions_now)}</b></li>)}{rest > 0 && <li><span>Bio vagy más hely</span><b>{fmt(rest)}</b></li>}</ul>
      <div className="jl-steps ir-flow-p">{([["scored", "Előnézetig jutott"], ["signups", "Regisztrált (becslés)"]] as const).map(([k, l]) => <span key={k}><i style={{ width: `${Math.max(3, Math.min(100, (n(L[k]) / Math.max(1, n(L.sessions))) * 100))}%` }} /><small>{l}</small><b>{fmt(L[k])} · {pct(n(L[k]), n(L.sessions))}</b></span>)}</div>
    </li>; })}</ul>;
}

export function Platforms({ days }: { days: number }) {
  const phone = usePhone();
  const { d, e } = useRpc("admin_social", { p_days: days }, [days]);
  const reach = useRpc("admin_social_reach", undefined, []);
  const [pick, setPick] = useState<string | null>(null);
  if (e) return <div className="g"><div className="alert err s12">{e}</div></div>;
  if (!d) return <Loading />;
  const accs: D[] = d.accounts || [], posts: D[] = d.posts || [], active: D[] = d.active || [], leads: D[] = d.leads || [], daily: D[] = d.daily || [];
  const PV: D = d.prev || {}, pl: D = PV.leads || {}, pp: D = PV.posts || {};
  const rows: D[] = SOC.map((pf) => {
    const ps = posts.filter((p) => p.platform === pf);
    /* what every post of the platform gathered on the chosen days (the same daily rule as everywhere) */
    /* a platform with no daily numbers at all (hand-added posts only) shows "–", not a measured-looking 0 */
    const snap = ((reach.d as D | null)?.platforms || []).find((x: D) => x.platform === pf)?.snap_since;
    const g0 = (d.gained || {})[pf];
    /* Pinterest: the account's day numbers up to its last day with data, the same number as on the other pages (the pins' own arrive days later) */
    const PIN: D | null = pf === "pinterest" ? d.pin || null : null;
    const views = PIN?.imps != null && days !== 1 ? n(PIN.imps) : pf === "pinterest" && days === 1 ? null : g0 != null ? n(g0) : snap ? 0 : null;
    const M: D = (d.measure || {})[pf] || {}, unmeasured = accs.some((a) => a.platform === pf) && !n(M.tagged) && !n(M.visits_ever);
    const inter = ps.reduce((t, p) => t + n(p.likes) + n(p.comments) + n(p.shares) + n(p.saves), 0);
    const L = leads.find((x) => x.k === pf) || {};
    /* the follower change of the chosen days only (the daily rows always reach back at least 30 days) */
    const since = new Date(Date.now() - days * 864e5).toLocaleDateString("sv-SE", { timeZone: "Europe/Budapest" });
    const fol = daily.filter((x) => x.platform === pf && x.followers != null && String(x.day) >= since);
    const last = fol.slice(-1)[0], first = fol[0];
    return { pf, unmeasured, bio: n(L.bio), connected: accs.some((a) => a.platform === pf), posts: ps.length, views, eng: per1k(inter, ps.reduce((t, p) => t + n(p.views), 0)), sessions: n(L.sessions), scored: n(L.scored), signups: n(L.signups), clicks: n(L.clicks),
      prev_sessions: n(pl[pf]?.sessions), full_now: n((d.full || {})[pf]?.now), full_prev: n((d.full || {})[pf]?.prev), prev_views: PIN ? n(PIN.imps_prev) : n((d.gained_full_prev || {})[pf]), cmp_views: PIN ? n(PIN.imps) : n((d.gained_full || {})[pf]), followers: last ? n(last.followers) : null, fol_gain: last && first && last !== first ? n(last.followers) - n(first.followers) : null,
      v1k: views == null ? null : per1k(n(L.sessions), views), s1k: views == null ? null : per1k(n(L.signups), views), a1k: views == null ? null : per1k(n(L.scored), views), perPost: ps.length ? n(L.sessions) / ps.length : null };
  });
  const live = rows.filter((r) => r.connected || r.posts || r.sessions);
  /* a ranking needs evidence on both sides, and one unit: plays are compared with plays, impressions with impressions, never with each other */
  const enough = (r: D) => r.v1k != null && r.views >= 200 && r.sessions >= MIN_VISITS;
  const playsOk = live.filter((r) => enough(r) && !imp(r.pf)).sort((a, b) => n(b.v1k) - n(a.v1k)), impsOk = live.filter((r) => enough(r) && imp(r.pf)).sort((a, b) => n(b.v1k) - n(a.v1k));
  const best = playsOk.length >= 2 ? playsOk[0] : impsOk.length >= 2 ? impsOk[0] : null;
  const partDay = days === 1;
  const most = [...live].sort((a, b) => b.sessions - a.sessions)[0];
  const tot = (k: string) => rows.reduce((t, r) => t + n(r[k]), 0);
  const sel = rows.find((r) => r.pf === pick) || most || rows[0];
  /* a rate is shown only with the visits to carry it */
  const rate = (r: D, v: number | null, dg: number, strong?: boolean) => { if (r.unmeasured) return <span className="mut" title="Nincs követhető link: nem mérhető.">{noRate}</span>; if (v == null) return "–"; if (r.sessions < MIN_VISITS) return <span className="mut" title={`Csak ${fmt(r.sessions)} látogatás: ebből még nem érdemes arányt számolni.`}>kevés adat</span>; return strong ? <b>{fmt(v, dg)}</b> : fmt(v, dg); };
  return (
    <div className="g">
      <FreshRow srcs={[...SOC, "events"]} />
      <div className="s12"><Hero flip label={<>Látogató a közösségi oldalakról · {partDay ? "ma eddig" : daysLabel(days)}<Info>Egy platform nem a nagy számoktól ér sokat, hanem attól, hány embert hoz a megtekintéseiből: ezt mutatja az „/ 1000” oszlop. A Pinterest megjelenést számol, a többi lejátszást: a kettő nem ugyanaz. Hogy melyik ér többet, ahhoz legalább két, azonos mértékegységű platform kell, mindegyikről {MIN_VISITS} látogatással.{live.filter((r) => r.unmeasured).length ? <> {live.filter((r) => r.unmeasured).map((r) => PF[r.pf]).join(", ")}: a látogatók nem mérhetők, mert nincs követhető link.</> : null}</Info></>} v={tot("sessions")}
        chg={!partDay && (tot("full_now") || tot("full_prev")) ? <Chg a={tot("full_now")} b={tot("full_prev")} tail="előtte" /> : undefined}
        sub={best ? <>A legtöbbet ér: {PF[best.pf]}, {fmt(n(best.v1k), 1)} látogató {imp(best.pf) ? "1000 megjelenésenként" : "1000 megtekintésenként"}</> : most && most.sessions ? <>A legtöbbet a(z) {PF[most.pf]} hozta ({fmt(most.sessions)}). Hogy melyik ér többet, arra még kevés az adat.</> : "Ebben az időszakban még nem jött látogató innen."} /></div>
      <section className="s12 ir-rings" aria-label="Platformok egymás mellett">{rows.map((r, i) => { const [kind, look] = LOOK[i % LOOK.length], total = tot("sessions"), on = sel?.pf === r.pf; return (
        <button key={r.pf} type="button" className={"ir-ringb " + look} aria-pressed={on} onClick={() => setPick(r.pf)}>
          <Ring p={!r.unmeasured && total ? r.sessions / total : 0} kind={kind} label={`${PF[r.pf]}: a közösségi látogatók ${pct(r.sessions, total)}-a`}><Logo k={r.pf} size={38} /></Ring>
          <b>{r.unmeasured ? "–" : fmt(r.sessions)}</b>
          <small>{PF[r.pf]}</small>
        </button>); })}</section>
      {sel && <Card className="s12" icon={P.target} title={PF[sel.pf]} sub="A gyűrű azt mutatja, hogy a közösségi oldalakról jött látogatók mekkora része jött erről a platformról. Érintsd meg a másik gyűrűt a váltáshoz."
        right={!sel.connected ? <a className="adm-ibtn sm" href="#connect">{sel.posts ? "kézi" : "bekötés"}</a> : undefined}>
        {sel.unmeasured && <p className="note">Egy posztban sincs követhető link, és az app nem adja át a forrást: a látogatók száma ismeretlen, nem nulla.</p>}
        <Trio items={[{ l: imp(sel.pf) ? "megjelenés" : "megtekintés", v: sel.views == null ? "–" : big(sel.views) }, { l: "előnézet", v: sel.unmeasured ? "–" : fmt(sel.scored) }, { l: "regisztráció", v: sel.unmeasured ? "–" : fmt(sel.signups) }]} />
        <Trio items={[{ l: "poszt", v: fmt(sel.posts) }, { l: "követő", v: sel.followers == null ? "–" : big(sel.followers) }, { l: imp(sel.pf) ? "látogató / 1000 megjelenés" : "látogató / 1000 megtekintés", v: rate(sel, sel.v1k, 1) }]} />
      </Card>}
      <Card className="s12" icon={P.layers} title="Mit ér egy platform?" src={[...SOC]}
        sub={<>Platformonként az időszakban: posztok, a posztok által gyűjtött <b>megtekintés</b> (Pinteresten és LinkedInen megjelenés), elköteleződés (kedvelés + komment + megosztás + mentés 1000 megtekintésenként), követők és változásuk, a mi mérésünkből a <b>látogató</b>, az <b>előnézet</b> (eljutott az előnézetig) és a <b>regisztráció</b>, végül ugyanezek <b>1000 megtekintésenként</b> és posztonként. A látogatót a követhető link, a bio és a hivatkozó alapján kötjük a platformhoz. A Pinterest számai a fiók napi jelentéséből jönnek, az utolsó adatos napig. {MIN_VISITS} látogatás alatt az „/ 1000” csak „kevés adat”.</>}>
        <Tbl name="platformok" rows={rows.map((r) => ({ ...r, name: PF[r.pf] }))} csv cols={[
          { k: "name", l: "Platform", r: (r) => <span style={{ display: "inline-flex", alignItems: "center", gap: 8, opacity: r.connected || r.posts ? 1 : 0.55 }}><Logo k={r.pf} size={22} /><b>{PF[r.pf]}</b>{!r.connected && <a className="lnk" href="#connect" style={{ fontSize: 11 }}>{r.posts ? "kézi" : "bekötés"}</a>}</span> },
          { k: "posts", l: "Poszt", num: true, r: (r) => fmt(r.posts) },
          { k: "views", l: "Megtekintés", num: true, r: (r) => r.views == null ? <span className="mut" title="Ehhez a platformhoz még nincs napi mérés (csak kézzel felvett posztok)">–</span> : <>{big(r.views)}{imp(r.pf) && <div className="mut" style={{ fontSize: 11 }}>megjelenés</div>}{!partDay && r.prev_views ? <div title="Változás a lezárt napokon"><Delta now={r.cmp_views} prev={r.prev_views} /></div> : null}</> },
          { k: "eng", l: "Elköt. / 1000", num: true, r: (r) => (r.eng == null ? "–" : fmt(r.eng, 1)) },
          { k: "followers", l: "Követő", num: true, r: (r) => (r.followers == null ? "–" : <>{big(r.followers)}{r.fol_gain != null && <div className="mut" style={{ fontSize: 11 }}>{r.fol_gain >= 0 ? "+" : ""}{fmt(r.fol_gain)}</div>}</>) },
          { k: "sessions", l: "Látogató", num: true, r: (r) => (r.unmeasured ? <span className="mut" title="Egy posztban sincs követhető link, és az app nem adja át a forrást: ez nem 0, hanem ismeretlen.">nem mérhető</span> : <><b>{fmt(r.sessions)}</b>{!partDay && (r.full_prev || r.full_now) ? <div title="Változás a lezárt napokon"><Delta now={r.full_now} prev={r.full_prev} /></div> : null}{r.bio > 0 ? <div className="mut" style={{ fontSize: 11 }}>{r.bio === r.sessions ? "mind a bio linkről" : `${fmt(r.bio)} a bio linkről`}</div> : null}</>) },
          { k: "scored", l: "Előnézet", num: true, r: (r) => (r.unmeasured ? "–" : fmt(r.scored)) },
          { k: "signups", l: "Regisztráció", num: true, r: (r) => (r.unmeasured ? "–" : fmt(r.signups)) },
          { k: "v1k", l: "Látogató / 1000", num: true, r: (r) => rate(r, r.v1k, 1, true) },
          { k: "a1k", l: "Előnézet / 1000", num: true, r: (r) => rate(r, r.a1k, 1) },
          { k: "s1k", l: "Regisztráció / 1000", num: true, r: (r) => rate(r, r.s1k, 2) },
          { k: "perPost", l: "Látogató / poszt", num: true, r: (r) => rate(r, r.perPost, 1) },
        ]} />
      </Card>
      <Card className="s6" icon={P.target} title="Látogató 1000 megtekintésenként" sub={`Melyik platform közönsége kattint át a legszívesebben a weboldalra. Legalább 200 megtekintés és ${MIN_VISITS} látogatás kell hozzá, különben egy-két látogató is nagy számnak látszana. A megjelenést számoló platform (Pinterest, LinkedIn) külön mértékegység: alá van írva.`}>
        {(() => { const rs = rows.filter((r) => !r.unmeasured && enough(r)).sort((a, b) => Number(imp(a.pf)) - Number(imp(b.pf)) || n(b.v1k) - n(a.v1k)), mx = Math.max(...rs.map((r) => n(r.v1k)), 0.001);
          return rs.length ? <div className="rate-l">{rs.map((r) => (
            <div key={r.pf} className="rate-i"><span className="rate-n"><Logo k={r.pf} size={18} /><b>{PF[r.pf]}</b><small>{big(r.views)} {imp(r.pf) ? "megjelenés" : "megtekintés"} · {fmt(r.sessions)} látogató{r.bio === r.sessions && r.bio ? " (mind a bio linkről, nem posztból)" : ""}</small></span>
              <span className="rate-v">{fmt(n(r.v1k), 1)}</span><i style={{ width: (n(r.v1k) / mx) * 100 + "%", background: chColor(r.pf) }} /></div>))}</div>
            : <Empty t={`Kevés adat: még egyik platformnak sincs legalább 200 megtekintése és ${MIN_VISITS} látogatása ebben az időszakban.`} />; })()}
      </Card>
      <Card className="s6" icon={P.users} title="Honnan jön a regisztráció" sub="A közösségi oldalakról jött regisztrációk megoszlása platformonként. A regisztráció becslés: az előtte lévő látogatáshoz kötjük.">
        <BarList items={rows.filter((r) => r.signups > 0).sort((a, b) => b.signups - a.signups).map((r) => ({ k: r.pf, n: r.signups }))} fmtK={(k) => PF[k]} color={(k) => chColor(k)} empty="Ebben az időszakban még nem jött regisztráció a közösségi oldalakról." />
      </Card>
      <Card className="s12" icon={P.traffic} title="Az út a poszttól a regisztrációig" sub="Platformonként a legtöbb látogatót hozó (rövid linkes) posztok, a többi látogatás a bióból vagy máshonnan; utána, hányan jutottak el az előnézetig, és hányan regisztráltak. A regisztráció becslés: a fiók nem tárolja, honnan jött, ezért az előtte lévő látogatáshoz kötjük.">
        {phone ? <FlowList posts={posts} leads={leads} /> : <PlatformFlow posts={posts} leads={leads} />}
      </Card>
      <ReachMatrix r={(reach.d as D | null) || null} pick={() => { location.hash = "social"; }} add={() => { location.hash = "social"; }} err={reach.e} retry={reach.load} />
    </div>
  );
}
