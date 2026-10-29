"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { BarList, CountUp, Funnel, TrendChart, Empty, fmt, pct } from "../charts";
import { Gauge, ViralTree } from "../wow";
import { Band, Card, Kpi, Lesson, Mini, P, Tbl, n, periodWords, series, type D, useBlockRpc, useRpc } from "../shared";

/* ---------- viral: the share links carry utm_source=share&utm_medium=<card kind>; the old ?ref= links still count ---------- */
const CARD: Record<string, string> = { ba: "Előtte–utána (most és 50 év múlva)", score: "Előnézet-link", sig: "Öregedés-videó", card: "Link (típus nélkül)", "?": "Egyéb" };
const FMT: Record<string, string> = { post: "Poszt (4:5)", story: "Story (9:16)", square: "Négyzet (1:1)", video: "Videó", "?": "Egyéb" };

export function Viral({ d }: { d: D }) {
  const v = useRpc("admin_viral", { p_from: d.from || null, p_to: d.to || null, p_ch: d.filter?.ch || null, p_lang: d.filter?.lang || null }, [d.from, d.to, d.filter?.ch, d.filter?.lang]);
  /* "A megosztás lépései" with a period of its own (admin_viral takes a start time: the picked day count from now) */
  const vb = useBlockRpc("admin_viral", { p_ch: d.filter?.ch || null, p_lang: d.filter?.lang || null }, [d.filter?.ch, d.filter?.lang], (b) => ({ p_from: b.fromIso, p_to: null }));
  const N = d.now || {}, c = d.counts || {};
  const V: D = (v.d as D) || {}, VN: D = V.now || {}, VP: D = V.prev || {};
  /* the dashboard's own share count as long as the viral reader has not answered */
  const shared = V.now ? n(VN.shared) : n(N.shared), scored = V.now ? n(VN.scored) : n(N.scored), sessions = V.now ? n(VN.sessions) : n(N.sessions);
  /* one rate on the whole page (and on Áttekintés): sharers who got a score ÷ those who got one (the band said 10%, the lesson 5%) */
  const ss = V.now ? n(VN.scored_shared) : n(N.scored_shared ?? N.shared), pss = V.prev ? n(VP.scored_shared) : n(d.prev?.scored_shared);
  const back = n(VN.back), backScored = n(VN.back_scored);
  const k = sessions ? back / sessions : 0;
  const kinds: D[] = V.kinds || [], fmts: D[] = V.fmts || [], via: D[] = V.via || [];
  const daily: D[] = V.daily || [];
  return (
    <div className="g">
      {v.e && <div className="alert err s12">{v.e}</div>}
      <Lesson>{scored ? <>Az előnézetet kapók <b>{pct(ss, scored)}</b>-a osztja meg az eredményét{ss / scored >= 0.1 ? <>: ez a 10%-os cél fölött van, szép!</> : <>; a cél 10%. A legerősebb húzás: az öregedés mellé egy „Mutasd meg a barátodnak” link.</>}{back ? <> A megosztott linkekről <b>{fmt(back)}</b> új látogató jött.</> : null}</> : <>Még nincs előnézet ebben az időszakban.</>}</Lesson>
      <Band plain label="Megosztási arány" value={scored ? (ss / scored) * 100 : 0} d={1} fmtFn={(x) => fmt(x, 1) + "%"} now={ss} prev={d.prev_partial ? undefined : pss}
        sentence={<>Az előnézetet kapók közül <b>{fmt(ss)}</b> nyitotta meg a megosztást (minden megosztó, előnézet nélkül is: {fmt(shared)}); a megosztott linkekről (utm_source=share) <b>{fmt(back)}</b> új látogató jött, közülük <b>{fmt(backScored)}</b> kapott előnézetet. Cél: 10% fölötti megosztás.</>} />
      <Kpi kind="own" to="@next" tone="butter" className="s4" icon={P.viral} l="Megosztó látogatás" v={<CountUp v={shared} />} now={shared} prev={V.prev ? n(VP.shared) : n(d.prev?.shared)} spark={series(d, "shared")} />
      <Kpi kind="own" to="@next" tone="pink" className="s4" icon={P.links} l="Megosztott linkről jött" v={<CountUp v={back} />} now={back} prev={n(VP.back)} sub="utm_source=share (vagy régi ?ref=) linkkel" />
      <Kpi kind="own" to="@next" tone="sky" className="s4" icon={P.target} l="Közülük előnézet" v={<CountUp v={backScored} />} now={backScored} prev={n(VP.back_scored)} sub={back ? `${pct(backScored, back)} a visszajöttekből` : "még senki nem jött vissza"} />
      <Card className="s4" icon={P.bolt} title="Virális együttható" sub="Megosztott linkről érkező látogatások / összes látogatás az időszakban. 0,3 fölött már érezhetően magától nő.">
        <Gauge v={k} label={k >= 0.3 ? "jó: magától is nő" : `${fmt(k, 2)} · cél: 0,3 fölött`} />
      </Card>
      <Card className="s8" icon={P.viral} title="Megosztási fa" sub="Egy megosztásból hányan jöttek vissza, és közülük hányan kaptak előnézetet.">
        <ViralTree shared={shared} visits={back} scored={backScored} />
      </Card>
      <Card className="s12" icon={P.layers} title="A megosztás lépései" right={vb.ctl} sub={`Előnézetet kapott → megnyitotta a megosztást → elmentette a videót vagy a PDF-et → valaki visszajött a linkjéről → az is előnézetet kapott (${periodWords(vb.p)}). Minden lépésnél az előzőhöz mért arány.`}>
        {vb.own && !vb.q.d ? <div className="skel" style={{ height: 200 }} /> : (() => { const O: D = vb.own ? ((vb.q.d as D).now || {}) : VN;
          return <Funnel steps={[{ k: "scored", l: "Előnézetet kapott", n: vb.own ? n(O.scored) : scored }, { k: "opened", l: "Megosztást nyitott", n: n(O.opened) }, { k: "saved", l: "Videót / PDF-et mentett", n: n(O.saved) },
            { k: "back", l: "Visszajött a linkről", n: vb.own ? n(O.back) : back }, { k: "back_scored", l: "Ő is előnézetet kapott", n: vb.own ? n(O.back_scored) : backScored }].map((s, i, a) => ({ ...s, prev: i ? a[i - 1].n : undefined }))} accentK="back" />; })()}
        {!vb.own && <div className="mini-stats" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", marginTop: 10 }}>
          <Mini l="Meghívó megosztva" v={c.share_open} /><Mini l="PDF a tetoválóművésznek" v={c.share_save} /><Mini l="Öregedés-videó" v={c.share_video} /><Mini l="Megosztó link" v={c.reveal_share} />
        </div>}
      </Card>
      <Card className="s12" icon={P.traffic} title="Megosztás és visszaérkezés naponta" sub="Hány látogatás osztott meg valamit, és hányan jöttek vissza megosztott linkről, naponta.">
        {daily.length > 1 ? <TrendChart data={daily.map((x) => ({ t: x.t, v: n(x.back), p: n(x.shared) }))} label="Visszajött" prevLabel="Megosztott" height={200} /> : <Empty t="Néhány nap megosztás után látszik az alakulás." />}
      </Card>
      <Card className="s4" icon={P.doc} title="Mit osztanak meg" sub="A megosztás típusa (megnyitás).">
        <BarList items={kinds.filter((x) => n(x.opens)).map((x) => ({ k: x.k, n: n(x.opens) }))} fmtK={(x) => CARD[x] || x} empty="Még nem osztottak meg semmit." /></Card>
      <Card className="s4" icon={P.layers} title="Formátum" sub="Story, poszt, négyzet: a story szinte mindig Instagram- vagy TikTok-story.">
        <BarList items={fmts.map((x) => ({ k: x.k, n: n(x.n) }))} fmtK={(x) => FMT[x] || x} empty="Még nincs adat." /></Card>
      <Card className="s4" icon={P.globe} title="Hova osztották meg" sub="Ahonnan a visszajött látogató érkezett (a hivatkozó oldal vagy az app beépített böngészője). Üzenetből (WhatsApp, iMessage) általában nincs hivatkozó: az a „Közvetlen”.">
        <BarList items={via.map((x) => ({ k: x.k, n: n(x.n), sub: `${fmt(x.scored)} előnézet` }))} empty="Még senki nem jött megosztott linkről." /></Card>
      <Card className="s12" icon={P.target} title="Melyik megosztás hoz új embert" sub="Típusonként: hányszor nyitották meg és mentették a megosztást, hányan jöttek vissza a linkjéről (utm_medium = a megosztás típusa), és közülük hányan kaptak előnézetet.">
        <Tbl name="kartyak" rows={kinds.map((x) => ({ ...x, rate: n(x.opens) ? n(x.back) / n(x.opens) : null }))} empty="Még nem osztottak meg semmit." cols={[
          { k: "k", l: "Típus", r: (r) => CARD[r.k] || r.k },
          { k: "opens", l: "Megnyitás", num: true, r: (r) => fmt(r.opens) }, { k: "saves", l: "Mentés", num: true, r: (r) => fmt(r.saves) },
          { k: "back", l: "Visszajött", num: true, r: (r) => <b>{fmt(r.back)}</b> },
          { k: "rate", l: "Megosztásonként", num: true, r: (r) => (r.rate != null ? fmt(r.rate, 2) : "–") }, { k: "back_scored", l: "Közülük előnézet", num: true, r: (r) => fmt(r.back_scored) },
        ]} />
      </Card>
    </div>
  );
}
