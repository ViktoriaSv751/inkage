"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { BarList, CountUp, Funnel, Info, TrendChart, Empty, fmt, pct } from "../charts";
import { ViralTree } from "../wow";
import { Card, Kpi, Lesson, Mini, P, n, periodWords, series, type D, useBlockRpc, useRpc } from "../shared";
import { Chg, Hero, Ring, Trio } from "../ink";
import { TRows, Top } from "./traffic";
import { LoadErr } from "./people";

/* ---------- sharing: a share is share_open (invite), share_video (aging video) or reveal_share (share link); saving the preview is its own number.
   The share links carry utm_source=share&utm_medium=<kind>; the old ?ref= links still count ---------- */
const CARD: Record<string, string> = { ba: "Előtte–utána (most és 50 év múlva)", score: "Előnézet-link", sig: "Öregedés-videó", card: "Link (típus nélkül)", preview: "Megosztott előnézet megnyitva (/v/…)", "?": "Megosztó link" };
const FMT: Record<string, string> = { post: "Poszt (4:5)", story: "Story (9:16)", square: "Négyzet (1:1)", video: "Videó", "?": "Egyéb" };

export function Viral({ d }: { d: D }) {
  const v = useRpc("admin_viral", { p_from: d.from || null, p_to: d.to || null, p_ch: d.filter?.ch || null, p_lang: d.filter?.lang || null }, [d.from, d.to, d.filter?.ch, d.filter?.lang]);
  /* "A megosztás lépései" with a period of its own (admin_viral takes a start time: the picked day count from now) */
  const vb = useBlockRpc("admin_viral", { p_ch: d.filter?.ch || null, p_lang: d.filter?.lang || null }, [d.filter?.ch, d.filter?.lang], (b) => ({ p_from: b.fromIso, p_to: null }));
  const N = d.now || {}, c = d.counts || {};
  const V: D = (v.d as D) || {}, VN: D = V.now || {}, VP: D = V.prev || {};
  /* the dashboard's own counts as long as the viral reader has not answered */
  const shared = V.now ? n(VN.shared) : n(N.shared), revealed = V.now ? n(VN.revealed) : n(N.revealed), sessions = V.now ? n(VN.sessions) : n(N.sessions), saves = V.now ? n(VN.saves) : n(N.saved);
  /* one rate on the whole page (and on Áttekintés): real sharers among those who looked at their tattoo 50 years on */
  const ss = V.now ? n(VN.revealed_shared) : n(N.revealed_shared), pss = V.prev ? n(VP.revealed_shared) : n(d.prev?.revealed_shared);
  const back = n(VN.back), backRev = n(VN.back_revealed);
  const k = sessions ? back / sessions : 0;
  const kinds: D[] = V.kinds || [], fmts: D[] = V.fmts || [], via: D[] = V.via || [];
  const daily: D[] = V.daily || [];
  return (
    <div className="g ix">
      {v.e && <div className="s12"><LoadErr e={v.e} retry={v.load} busy={v.busy} /></div>}
      <Top pc><Hero flip label={<>Megosztási arány<Info>Akik megnézték a tetoválásukat 50 év múlva, közülük <b>{fmt(ss)}</b> osztott meg linket, videót vagy meghívót (minden megosztó: {fmt(shared)}). Az előnézet mentése külön szám: {fmt(saves)}. Megosztott linkről (utm_source=share) <b>{fmt(back)}</b> látogató jött, közülük <b>{fmt(backRev)}</b> a saját tetoválását is megnézte 50 év múlva.</Info></>} v={revealed ? (ss / revealed) * 100 : 0} d={1} unit="%"
        chg={d.prev_partial ? undefined : <Chg a={ss} b={pss} tail="megosztó az előző időszakhoz" />} sub={`${fmt(ss)} / ${fmt(revealed)} látogatás`} side={<Trio items={[{ l: "megosztó", v: fmt(shared) }, { l: "mentés", v: fmt(saves) }, { l: "linkről jött", v: fmt(back) }]} />} /></Top>
      <Lesson>{revealed ? <>{back ? <>Megosztott linkről <b>{fmt(back)}</b> látogató jött.</> : <>Megosztott linkről eddig senki nem jött ebben az időszakban.</>} Az előnézet mentése nem számít megosztásnak.</> : <>Ebben az időszakban még senki nem nézte meg a tetoválását 50 év múlva.</>} A látogatási számok csak azoktól jönnek, akik elfogadták a statisztikát.</Lesson>
      <Kpi kind="own" to="@next" tone="butter" className="s3" icon={P.viral} l="Megosztó látogatás" v={<CountUp v={shared} />} now={shared} prev={V.prev ? n(VP.shared) : n(d.prev?.shared)} spark={series(d, "shared")} sub="link, videó vagy meghívó, a mentés nélkül" />
      <Kpi kind="own" to="@next" tone="butter" className="s3" icon={P.doc} l="Mentés" v={<CountUp v={saves} />} now={saves} prev={V.prev ? n(VP.saves) : n(d.prev?.saved)} spark={series(d, "saved")} sub="elmentett előnézet, nem megosztás" />
      <Kpi kind="own" to="@next" tone="pink" className="s3" icon={P.links} l="Megosztott linkről jött" v={<CountUp v={back} />} now={back} prev={n(VP.back)} sub="utm_source=share jelölésű linkkel" />
      <Kpi kind="own" to="@next" tone="sky" className="s3" icon={P.target} l="Közülük megnézte 50 év múlva" v={<CountUp v={backRev} />} now={backRev} prev={n(VP.back_revealed)} sub={back ? `${pct(backRev, back)} a linkről jöttekből` : "még senki nem jött megosztott linkről"} />
      <Card className="s4 ph-hide" icon={P.bolt} title="Megosztott linkről jött arány" sub="A látogatások hány %-a jött megosztott linkről. Ez nem virális együttható: azt mutatná meg, hány új embert hoz egy felhasználó, ahhoz viszont nem követjük az embereket.">
        <div className="ix-ring1"><Ring p={k} kind="seg"><b>{fmt(k * 100, 1)}%</b></Ring><small>{fmt(back)} / {fmt(sessions)} látogatás</small></div>
      </Card>
      <Card className="s8 ph-hide" icon={P.viral} title="Megosztási fa" sub="A megosztó látogatásokból hányan jöttek a linkről, és közülük hányan nézték meg a saját tetoválásukat 50 év múlva.">
        <ViralTree shared={shared} visits={back} scored={backRev} />
      </Card>
      <Card className="s12" icon={P.layers} title="A megosztás lépései" right={vb.ctl} sub={`Megnézte 50 év múlva → megosztott → valaki jött a linkjéről → az is megnézte a sajátját 50 év múlva (${periodWords(vb.p)}). Minden lépésnél az előzőhöz mért arány. Az előnézet mentése nem lépés itt, külön szám fent.`}>
        {vb.own && vb.q.e && !vb.q.d ? <LoadErr e={vb.q.e} retry={vb.q.load} busy={vb.q.busy} /> : vb.own && !vb.q.d ? <div className="skel" style={{ height: 200 }} /> : (() => { const O: D = vb.own ? ((vb.q.d as D).now || {}) : VN;
          return <Funnel steps={[{ k: "revealed", l: "Megnézte 50 év múlva", n: vb.own ? n(O.revealed) : revealed }, { k: "opened", l: "Megosztott", n: vb.own ? n(O.shared) : shared },
            { k: "back", l: "Jött a linkről", n: vb.own ? n(O.back) : back }, { k: "back_revealed", l: "Ő is megnézte 50 év múlva", n: vb.own ? n(O.back_revealed) : backRev }].map((s, i, a) => ({ ...s, prev: i ? a[i - 1].n : undefined }))} accentK="back" />; })()}
        {!vb.own && <div className="mini-stats" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", marginTop: 10 }}>
          <Mini l="Meghívó megosztva" v={c.share_open} /><Mini l="Öregedés-videó" v={c.share_video} /><Mini l="Megosztó link" v={c.reveal_share} /><Mini l="PDF a tetoválónak (nem megosztás)" v={c.share_save} /><Mini l="Megosztott előnézet megnyitva" v={c.share_view} />
        </div>}
      </Card>
      <Card className="s12" icon={P.traffic} title="Megosztás és visszaérkezés naponta" sub="Hány látogatás osztott meg valamit, és hányan jöttek megosztott linkről, naponta.">
        {daily.length > 1 ? <TrendChart data={daily.map((x) => ({ t: x.t, v: n(x.back), p: n(x.shared) }))} label="Linkről jött" prevLabel="Megosztott" height={200} /> : <Empty t="Néhány nap megosztás után látszik az alakulás." />}
      </Card>
      <Card className="s4" icon={P.doc} title="Mit osztanak meg" sub="A megosztás típusa (megnyitás).">
        <BarList items={kinds.filter((x) => n(x.opens)).map((x) => ({ k: x.k, n: n(x.opens) }))} fmtK={(x) => CARD[x] || x} empty="Még nem osztottak meg semmit." /></Card>
      <Card className="s4" icon={P.layers} title="Formátum" sub="Story, poszt, négyzet: a story szinte mindig Instagram- vagy TikTok-story.">
        <BarList items={fmts.map((x) => ({ k: x.k, n: n(x.n) }))} fmtK={(x) => FMT[x] || x} empty="Még nincs adat." /></Card>
      <Card className="s4" icon={P.globe} title="Hova osztották meg" sub="Ahonnan a megosztott linkről jött látogató érkezett (a hivatkozó oldal vagy az app beépített böngészője). Üzenetből (WhatsApp, iMessage) általában nincs hivatkozó: az a „Közvetlen”.">
        <BarList items={via.map((x) => ({ k: x.k, n: n(x.n) }))} empty="Még senki nem jött megosztott linkről." /></Card>
      <Card className="s12" icon={P.target} title="Melyik megosztás hoz új embert" sub="Típusonként: hányszor nyitották meg a megosztást, hány videót mentettek, és hányan jöttek a linkjéről (utm_medium = a megosztás típusa). Az előnézet mentése nincs benne.">
        <TRows name="kartyak" rows={kinds.map((x) => ({ ...x, rate: n(x.opens) ? n(x.back) / n(x.opens) : null }))} empty="Még nem osztottak meg semmit." cols={[
          { k: "k", l: "Típus", r: (r) => <b>{CARD[r.k] || r.k}</b> },
          { k: "opens", l: "Megnyitás", num: true, r: (r) => fmt(r.opens) }, { k: "saves", l: "Videó mentve", num: true, r: (r) => fmt(r.saves) },
          { k: "back", l: "Linkről jött", num: true, r: (r) => <b>{fmt(r.back)}</b> },
          { k: "rate", l: "Megosztásonként", num: true, r: (r) => (r.rate != null ? fmt(r.rate, 2) : "–") },
        ]} />
      </Card>
    </div>
  );
}
