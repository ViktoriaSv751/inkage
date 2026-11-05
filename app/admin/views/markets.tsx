"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import { BarList, Empty, Info, Scatter, fmt, pct } from "../charts";
import { CountryList, WorldMap, countryName } from "../visuals";
import { A3, Card, P, PF, Tbl, lang, n, periodName, type D, useFlt, useRpc } from "../shared";
import { Hero, Trio } from "../ink";
import { usePhone } from "../phone";
import { PhMore } from "./people";
import { Pills } from "./reach-ink";

/* country names (as Apple's reports write them) → two letters */
const NAME2: Record<string, string> = (() => {
  const o: Record<string, string> = {};
  try { const dn = new Intl.DisplayNames(["en"], { type: "region" }); for (let a = 65; a <= 90; a++) for (let b = 65; b <= 90; b++) { const c = String.fromCharCode(a, b), nm = dn.of(c); if (nm && nm !== c) o[nm.toLowerCase()] = c; } } catch {}
  return o;
})();
const a2 = (k: string) => { const s = String(k || "").trim(); if (/^[A-Za-z]{2}$/.test(s)) return s.toUpperCase(); return A3[s.toLowerCase()] || NAME2[s.toLowerCase()] || ""; };
const toMap = (rows: D[] = [], key = "n") => { const m: Record<string, number> = {}; rows.forEach((r) => { const c = a2(r.k); if (c) m[c] = (m[c] || 0) + n(r[key]); }); return m; };

/* the languages as large letters: a language is no country, so no flag */
function LangTiles({ langs, onPick, max, cur }: { langs: D[]; onPick: (k: string) => void; max: number; cur?: string }) {
  const tot = langs.reduce((t, x) => t + n(x.n), 0) || 1;
  if (!langs.length) return <Empty t="Még nincs látogatás ebben az időszakban." icon={P.globe} />;
  return <div className="ir-lgs">{langs.slice(0, max).map((l) => <button key={l.k} type="button" className="ir-lg" aria-pressed={cur === l.k} onClick={() => onPick(l.k)}>
    <b>{String(l.k).slice(0, 2).toUpperCase()}</b><span>{lang(l.k)}</span><em>{fmt(l.n)}</em><small>{pct(n(l.n), tot)} · {l.revealed != null ? `${pct(n(l.revealed), n(l.n))} megnézte 50 év múlva` : `${pct(n(l.scored), n(l.n))} az előnézetig`}</small></button>)}</div>;
}

/* ---------- markets ---------- */
export function Markets({ d, days }: { d: D; days: number }) {
  const { f, set } = useFlt();
  const M = useRpc("admin_markets", { p_days: days || 3650 }, [days]);
  const X: D = (M.d as D) || {};
  /* one measure: the active visits per language, also with a language picked (the tiles stay, the picked one lit). Only a channel filter
     needs the dashboard's filtered list, and that counts every visit, so then the words say "látogatás" */
  const activeOnly = !f.ch && !!X.langs, unit = activeOnly ? "aktív látogatás" : "látogatás";
  const pickLang = (k: string) => set({ lang: f.lang === k ? undefined : k });
  const langs = ((activeOnly ? (X.langs as D[]).map((x) => ({ ...x, n: x.engaged, all: x.n })) : d.langs || []) as D[]).filter((x) => x.k && x.k !== "?" && n(x.n) > 0).sort((a, b) => n(b.n) - n(a.n));
  const has: D = X.has || {}, no = (k: string) => has[k] === false;
  const gt: D = X.gsc_total || {}, gp: D = X.gsc_part || {};
  const acc = new Map(((X.acc_langs || []) as D[]).map((x) => [String(x.k).slice(0, 2), n(x.n)]));
  const pts = langs.map((x) => ({ k: x.k, l: lang(x.k), x: n(x.n), y: n(x.scored) / Math.max(1, n(x.n)), r: 4 + Math.sqrt(n(x.scored)) * 1.6 }));
  const best = [...pts].filter((p) => p.x >= 10).sort((a, b) => b.y - a.y)[0];
  const gsc = useMemo(() => toMap(X.gsc, "clicks"), [X.gsc]);
  const apple = useMemo(() => toMap(X.apple_dl), [X.apple_dl]), play = useMemo(() => toMap(X.play_dl), [X.play_dl]);
  const dl = useMemo(() => { const m = { ...apple }; Object.entries(play).forEach(([k, v]) => (m[k] = (m[k] || 0) + v)); return m; }, [apple, play]);
  const imp = useMemo(() => toMap(X.apple_imp), [X.apple_imp]), pv = useMemo(() => toMap(X.apple_pv), [X.apple_pv]);
  const aud = useMemo(() => toMap(X.audience), [X.audience]);
  type Mode = "gsc" | "dl" | "imp" | "aud";
  const [picked, setMode] = useState<Mode | null>(null);
  /* the map opens on the first source that really has countries; a language is never drawn as a country */
  const SRCS: Record<Mode, Record<string, number>> = { gsc, dl, imp, aud };
  const mode: Mode = picked || (["gsc", "dl", "imp", "aud"] as const).find((k) => Object.keys(SRCS[k]).length > 0) || "gsc";
  const vals = SRCS[mode];
  const lbl = { gsc: "Google-kattintás (részleges)", dl: "letöltés", imp: "App Store-megjelenés", aud: "követő / néző" }[mode];
  const empty = !Object.keys(vals).length;
  const note = { gsc: "A Google Search Console bekötése után jelennek meg az országok.", dl: "Nincs adat, ez nem nulla: az App Store Connect (sales) és a Google Play-jelentések bekötése után jelennek meg a letöltések.", imp: "Nincs adat, ez nem nulla: az App Store Connect-analitika bekötése után jelenik meg.", aud: "Nincs adat, ez nem nulla: az Instagram és a YouTube adhatja ki a közönség országát, de még nem érkezett tőlük ilyen adat." }[mode];
  const sum = Object.values(vals).reduce((t, v) => t + v, 0), top3 = Object.entries(vals).filter(([, v]) => v > 0).sort((x, y) => y[1] - x[1]).slice(0, 3);
  /* one row per country: every source side by side */
  const matrix = useMemo(() => {
    /* measured numbers only: a language says nothing about a country, so it has its own list above */
    const keys = new Set([...Object.keys(gsc), ...Object.keys(apple), ...Object.keys(play), ...Object.keys(imp), ...Object.keys(aud)]);
    return [...keys].map((c) => ({ c, name: countryName(c), gsc: gsc[c] || 0, apple: apple[c] || 0, play: play[c] || 0, imp: imp[c] || 0, pv: pv[c] || 0, aud: aud[c] || 0 }))
      .filter((r) => r.gsc + r.apple + r.play + r.imp + r.pv + r.aud > 0)
      .sort((a, b) => b.gsc + b.apple + b.play + b.aud / 100 - (a.gsc + a.apple + a.play + a.aud / 100));
  }, [gsc, apple, play, imp, pv, aud]);
  const cell = (v: number, k: string) => (no(k) ? <span className="mut">nincs adat</span> : fmt(v));
  const plats = Array.from(new Set(((X.audience || []) as D[]).map((x) => x.platform)));
  const phone = usePhone();
  const modes = ([["gsc", "Google"], ["dl", "Letöltés"], ["imp", "App Store"], ["aud", "Közönség"]] as const);
  const langInfo = <>{langs[0] ? <>A legnagyobb nyelv: <b>{lang(langs[0].k)}</b> ({fmt(langs[0].n)} {unit}).{activeOnly ? "" : " Csatornaszűrő alatt az összes látogatást mutatjuk, nem csak az aktívakat."} A nyelv nem ország: az angol oldalt bárhol nézhetik, a látogatás országát pedig nem mérjük. </> : null}{best ? <>A legjobban konvertáló (legalább 10 látogatással): <b>{best.l}</b>, {activeOnly ? "az aktív látogatások" : "a látogatások"} {fmt(best.y * 100, 1)}%-a jut el az előnézetig.</> : null} Egy nyelvre kattintva a szűrő arra a nyelvre áll, újabb kattintásra kikapcsol; a szűrőt követő oldalak (Áttekintés, Források, Tölcsér, Használat, Megtartás) annak számait mutatják. {d.filter?.from ? "Egyedi időszaknál a látogatások a választott napokat mutatják, a fiókok, a Google és az áruházak blokkjai viszont a kezdőnaptól máig számolnak." : "Minden blokk ugyanazt az időszakot mutatja."} A látogatás nyelve az, amelyiken véget ért (az első esemény még a nyelv beállítása előtt indul).</>;
  return (
    <div className="g">
      {/* the whole map, a glass panel over it: only what the sources really give per country */}
      <section className="ir-stage s12" aria-label="Világtérkép">
        <WorldMap fill values={vals} label={lbl} height={phone ? 640 : 680} viewTop={phone ? 300 : 0} />
        <div className="ir-glass">
          <Hero label={<>{lbl[0].toUpperCase() + lbl.slice(1)}, országonként<Info>A nyelv nem ország: ide csak az kerül, amit a forrás országra ad. Google: országonként csak a Google részleges bontása van. Letöltés: App Store és Google Play együtt. Megjelenés: az App Store-ban. Közönség: a platformok követői és nézői.{mode === "gsc" && gt.clicks != null ? <> A Google pontos összege {fmt(gt.clicks)} kattintás és {fmt(gt.impressions)} megjelenés; országokra bontva ebből {fmt(gp.clicks)} kattintás látszik ({pct(n(gp.clicks), n(gt.clicks))}).</> : null}</Info></>} v={empty ? null : sum} sub={empty ? undefined : `${fmt(Object.values(vals).filter((v) => Number(v) > 0).length)} ország ${periodName(d)}`} />
          <Pills items={modes} cur={mode} pick={setMode} label="Mit mutasson a térkép" />
          {empty ? <div className="ir-empty"><p>{note}</p><a className="adm-ibtn gold" href="#connect">Bekötés</a></div>
            : <div className="ir-top3">{top3.map(([k, v], i) => <div key={k}><b>{fmt(v)}</b><small>{i + 1}. {countryName(k)}</small></div>)}</div>}
        </div>
      </section>
      <Card className="s6" icon={P.layers} src={["gsc", "apple", "google"]} title="Országok rangsora" sub={`Ami országonként valóban mért: ${lbl}. Ahol nincs adat, az nem nulla.`}>
        {empty ? <Empty t={note} icon={P.globe} /> : <CountryList values={vals} label={lbl} max={9} />}
      </Card>
      <Card className="s6" icon={P.globe} title="Nyelvek" sub={langInfo}>
        <div className="ir-gap"><Trio items={[{ l: "nyelven jöttek", v: fmt(langs.length) }, { l: "a legnagyobb", v: langs[0] ? String(langs[0].k).toUpperCase() : "–" }, { l: "legjobban konvertál", v: best ? String(best.k).toUpperCase() : "–" }]} />
          <LangTiles langs={langs} onPick={pickLang} cur={f.lang} max={phone ? 6 : 8} /></div>
      </Card>
      <PhMore label="Méret és konverzió, országok egy sorban, a platformok közönsége">
      <Card className="s8" icon={P.target} title="Méret × konverzió" sub={`Vízszintesen ${activeOnly ? "az aktív látogatások" : "a látogatások"} száma nyelvenként (logaritmikus), függőlegesen hány % jut el az előnézetig; a buborék mérete az előnézetek száma. Jobbra fent: nagy és jól konvertáló piac, ide érdemes több tartalom.`}>
        {pts.length ? <div className="ir-scatter"><Scatter pts={pts} xl="Látogatás" yl="Előnézetig" /><p className="note">Szaggatott vonal: az átlag, {fmt((pts.reduce((s, p) => s + p.y * p.x, 0) / Math.max(1, pts.reduce((s, p) => s + p.x, 0))) * 100, 1)}%.</p></div> : <Empty t="Még nincs elég adat." ghost />}
      </Card>
      <Card className="s4 ph-hide" icon={P.globe} title="Nyelvek részletesen" sub={(activeOnly ? "Aktív látogatás" : "Látogatás") + ", előnézet és új fiók nyelvenként, nem országonként (a fióknál a fiók nyelve, Google- és Apple-fióknál a regisztráló látogatásé, ami becslés)."}><BarList items={langs.map((x) => ({ k: x.k, n: n(x.n), sub: `${fmt(x.scored)} előnézet · ${pct(n(x.scored), n(x.n))} · ${fmt(acc.get(String(x.k).slice(0, 2)) || 0)} új fiók` }))} fmtK={lang} max={12} accent onPick={pickLang} /></Card>
      <Card className="s12" icon={P.layers} src={["gsc", "apple", "google"]} title="Országok egy sorban" sub="A mért országos számok egymás mellett: a Google részleges kattintása, App Store- és Google Play-letöltés, App Store-megjelenés és termékoldal-megtekintés, a platformok közönsége. A „nincs adat” azt jelenti, hogy ebből a forrásból egyetlen sor sem érkezett, ez nem nulla. A látogatások nyelve nincs itt, mert az nem ország.">
        <Tbl name="orszagok" rows={matrix} empty="Még nincs országos adat." cols={[
          { k: "name", l: "Ország", r: (r) => <b>{r.name}</b> },
          { k: "gsc", l: "Google-kattintás (részleges)", num: true, r: (r) => fmt(r.gsc) }, { k: "apple", l: "App Store-letöltés", num: true, r: (r) => cell(r.apple, "apple") },
          { k: "play", l: "Play-telepítés", num: true, r: (r) => cell(r.play, "play") }, { k: "imp", l: "App Store-megjelenés", num: true, r: (r) => cell(r.imp, "imp") },
          { k: "pv", l: "Termékoldal", num: true, r: (r) => cell(r.pv, "pv") }, { k: "aud", l: "Közönség", num: true, r: (r) => cell(r.aud, "aud") },
        ]} />
      </Card>
      {plats.length > 0 && <Card className="s12" icon={P.globe} src={["tiktok", "instagram", "facebook", "pinterest", "linkedin", "youtube"]} title="A közönséged országai a platformokon" sub="A követők és nézők országa, ahogy a platform kiadja (platformonként egyszer). A TikTok, a Facebook, a Pinterest és a LinkedIn ezt a mostani bekötéssel nem adja ki, ezért ott nem jelenik meg.">
        <div className="demo-cols">{plats.map((p) => <div key={p}><h4>{PF[p] || p}</h4><BarList items={((X.audience || []) as D[]).filter((x) => x.platform === p).map((x) => ({ k: a2(x.k) || x.k, n: n(x.n) }))} fmtK={(k) => countryName(k)} max={8} accent /></div>)}</div>
      </Card>}
      </PhMore>
    </div>
  );
}
