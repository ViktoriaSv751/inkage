"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { BarList, Delta, Empty, chColor, fmt } from "../charts";
import { Logo } from "../wow";
import { Band, Card, FreshRow, Loading, P, PF, SOC, Tbl, big, daysLabel, n, type D, useRpc } from "../shared";
import { ReachMatrix } from "./social-wave";
import { PlatformFlow } from "./visual";

/* ---------- Platformok: the platforms side by side ----------
   Not who has the biggest numbers, but what each platform is worth: how many visitors, analyses and sign-ups its
   views bring (per 1000 views), and per post. A platform's "views" are what its posts gathered in the period (the
   posts of the period with all their views, older posts with what they gathered since); Pinterest and LinkedIn count
   impressions, so they are compared per 1000 impressions and never added to the others. */
const imp = (pf: string) => pf === "pinterest" || pf === "linkedin";
const per1k = (a: number, v: number) => (v > 0 ? (a * 1000) / v : null);

export function Platforms({ days }: { days: number }) {
  const { d, e } = useRpc("admin_social", { p_days: days }, [days]);
  const reach = useRpc("admin_social_reach", undefined, []);
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
    const views = g0 != null ? n(g0) : snap ? 0 : null;
    const inter = ps.reduce((t, p) => t + n(p.likes) + n(p.comments) + n(p.shares) + n(p.saves), 0);
    const L = leads.find((x) => x.k === pf) || {};
    /* the follower change of the chosen days only (the daily rows always reach back at least 30 days) */
    const since = new Date(Date.now() - days * 864e5).toLocaleDateString("sv-SE", { timeZone: "Europe/Budapest" });
    const fol = daily.filter((x) => x.platform === pf && x.followers != null && String(x.day) >= since);
    const last = fol.slice(-1)[0], first = fol[0];
    return { pf, connected: accs.some((a) => a.platform === pf), posts: ps.length, views, eng: per1k(inter, ps.reduce((t, p) => t + n(p.views), 0)), sessions: n(L.sessions), scored: n(L.scored), signups: n(L.signups), clicks: n(L.clicks),
      prev_sessions: n(pl[pf]?.sessions), prev_views: n((d.gained_prev || {})[pf]), followers: last ? n(last.followers) : null, fol_gain: last && first && last !== first ? n(last.followers) - n(first.followers) : null,
      v1k: views == null ? null : per1k(n(L.sessions), views), s1k: views == null ? null : per1k(n(L.signups), views), a1k: views == null ? null : per1k(n(L.scored), views), perPost: ps.length ? n(L.sessions) / ps.length : null };
  });
  const live = rows.filter((r) => r.connected || r.posts || r.sessions);
  const best = [...live].filter((r) => r.v1k != null && r.views >= 200).sort((a, b) => n(b.v1k) - n(a.v1k))[0];
  const most = [...live].sort((a, b) => b.sessions - a.sessions)[0];
  const tot = (k: string) => rows.reduce((t, r) => t + n(r[k]), 0);
  return (
    <div className="g">
      <FreshRow srcs={[...SOC, "events"]} />
      <Band label={`Platformok egymás mellett · ${daysLabel(days)}`} value={tot("sessions")} now={tot("sessions")} prev={tot("prev_sessions")} unit="látogató a közösségi oldalakról"
        sentence={<>{most && most.sessions ? <>A legtöbb látogatót a(z) <b>{PF[most.pf]}</b> hozta ({fmt(most.sessions)}). </> : "Ebben az időszakban még nem jött látogató a közösségi oldalakról. "}
          {best ? <>A legtöbbet ér: <b>{PF[best.pf]}</b>, {fmt(n(best.v1k), 1)} látogató {imp(best.pf) ? "1000 megjelenésenként" : "1000 megtekintésenként"}. </> : null}
          Egy platform nem a nagy számoktól ér sokat, hanem attól, hány embert hoz a megtekintéseiből: ezt mutatja az „/ 1000” oszlop.</>} />
      <Card className="s12" icon={P.layers} title="Mit ér egy platform?" src={[...SOC]}
        sub={<>Platformonként az időszakban: posztok, a posztok által gyűjtött <b>megtekintés</b> (Pinteresten és LinkedInen megjelenés), elköteleződés (kedvelés + komment + megosztás + mentés 1000 megtekintésenként), követők és változásuk, a mi mérésünkből a <b>látogató</b>, az <b>előnézet</b> (eljutott az előnézetig) és a <b>regisztráció</b>, végül ugyanezek <b>1000 megtekintésenként</b> és posztonként. A látogatót a rövid link, a bio és a hivatkozó alapján kötjük a platformhoz.</>}>
        <Tbl name="platformok" rows={rows} csv cols={[
          { k: "pf", l: "Platform", r: (r) => <span style={{ display: "inline-flex", alignItems: "center", gap: 8, opacity: r.connected || r.posts ? 1 : 0.55 }}><Logo k={r.pf} size={22} /><b>{PF[r.pf]}</b>{!r.connected && <a className="lnk" href="#connect" style={{ fontSize: 11 }}>{r.posts ? "kézi" : "bekötés"}</a>}</span> },
          { k: "posts", l: "Poszt", num: true, r: (r) => fmt(r.posts) },
          { k: "views", l: "Megtekintés", num: true, r: (r) => r.views == null ? <span className="mut" title="Ehhez a platformhoz még nincs napi mérés (csak kézzel felvett posztok)">–</span> : <>{big(r.views)}{imp(r.pf) && <div className="mut" style={{ fontSize: 11 }}>megjelenés</div>}{r.prev_views ? <div><Delta now={r.views} prev={r.prev_views} /></div> : null}</> },
          { k: "eng", l: "Elköt. / 1000", num: true, r: (r) => (r.eng == null ? "–" : fmt(r.eng, 1)) },
          { k: "followers", l: "Követő", num: true, r: (r) => (r.followers == null ? "–" : <>{big(r.followers)}{r.fol_gain != null && <div className="mut" style={{ fontSize: 11 }}>{r.fol_gain >= 0 ? "+" : ""}{fmt(r.fol_gain)}</div>}</>) },
          { k: "sessions", l: "Látogató", num: true, r: (r) => <><b>{fmt(r.sessions)}</b>{r.prev_sessions || r.sessions ? <div><Delta now={r.sessions} prev={r.prev_sessions} /></div> : null}</> },
          { k: "scored", l: "Előnézet", num: true, r: (r) => fmt(r.scored) },
          { k: "signups", l: "Regisztráció", num: true, r: (r) => fmt(r.signups) },
          { k: "v1k", l: "Látogató / 1000", num: true, r: (r) => (r.v1k == null ? "–" : <b>{fmt(r.v1k, 1)}</b>) },
          { k: "a1k", l: "Előnézet / 1000", num: true, r: (r) => (r.a1k == null ? "–" : fmt(r.a1k, 1)) },
          { k: "s1k", l: "Regisztráció / 1000", num: true, r: (r) => (r.s1k == null ? "–" : fmt(r.s1k, 2)) },
          { k: "perPost", l: "Látogató / poszt", num: true, r: (r) => (r.perPost == null ? "–" : fmt(r.perPost, 1)) },
        ]} />
      </Card>
      <Card className="s6" icon={P.target} title="Látogató 1000 megtekintésenként" sub="Melyik platform közönsége kattint át a legszívesebben a weboldalra. Legalább 200 megtekintés kell hozzá, különben egy-két látogató is nagy számnak látszana.">
        {(() => { const rs = rows.filter((r) => r.v1k != null && r.views >= 200).sort((a, b) => n(b.v1k) - n(a.v1k)), mx = Math.max(...rs.map((r) => n(r.v1k)), 0.001);
          return rs.length ? <div className="rate-l">{rs.map((r) => (
            <div key={r.pf} className="rate-i"><span className="rate-n"><Logo k={r.pf} size={18} /><b>{PF[r.pf]}</b><small>{big(r.views)} {imp(r.pf) ? "megjelenés" : "megtekintés"} · {fmt(r.sessions)} látogató</small></span>
              <span className="rate-v">{fmt(n(r.v1k), 1)}</span><i style={{ width: (n(r.v1k) / mx) * 100 + "%", background: chColor(r.pf) }} /></div>))}</div>
            : <Empty t="Még egyik platformnak sincs legalább 200 megtekintése ebben az időszakban." />; })()}
      </Card>
      <Card className="s6" icon={P.users} title="Honnan jön a regisztráció" sub="A közösségi oldalakról jött látogatások közül hányból lett regisztráció, platformonként.">
        <BarList items={rows.filter((r) => r.signups > 0).sort((a, b) => b.signups - a.signups).map((r) => ({ k: r.pf, n: r.signups }))} fmtK={(k) => PF[k]} color={(k) => chColor(k)} empty="Ebben az időszakban még nem jött regisztráció a közösségi oldalakról." />
      </Card>
      <Card className="s12" icon={P.traffic} title="Az út a poszttól a regisztrációig" sub="Platformonként a legtöbb látogatót hozó (rövid linkes) posztok, a többi látogatás a bióból vagy máshonnan; utána, hányan jutottak el az előnézetig, és hányan regisztráltak. A regisztráció becslés: a fiók nem tárolja, honnan jött, ezért az előtte lévő látogatáshoz kötjük. Rámutatva a pontos számok.">
        <PlatformFlow posts={posts} leads={leads} />
      </Card>
      <ReachMatrix r={(reach.d as D | null) || null} pick={() => { location.hash = "social"; }} add={() => { location.hash = "social"; }} err={reach.e} retry={reach.load} />
    </div>
  );
}
