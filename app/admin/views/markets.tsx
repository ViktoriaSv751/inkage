"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import { BarList, Empty, Scatter, fmt, pct } from "../charts";
import { CountryList, LANG_LAND, WorldMap, countryName, flag } from "../visuals";
import { A3, Band, Card, P, PF, Tbl, lang, langLand, n, periodName, type D, useFlt, useRpc } from "../shared";
import { LangCards } from "./home";

/* country names (as Apple's reports write them) → two letters */
const NAME2: Record<string, string> = (() => {
  const o: Record<string, string> = {};
  try { const dn = new Intl.DisplayNames(["en"], { type: "region" }); for (let a = 65; a <= 90; a++) for (let b = 65; b <= 90; b++) { const c = String.fromCharCode(a, b), nm = dn.of(c); if (nm && nm !== c) o[nm.toLowerCase()] = c; } } catch {}
  return o;
})();
const a2 = (k: string) => { const s = String(k || "").trim(); if (/^[A-Za-z]{2}$/.test(s)) return s.toUpperCase(); return A3[s.toLowerCase()] || NAME2[s.toLowerCase()] || ""; };
const toMap = (rows: D[] = [], key = "n") => { const m: Record<string, number> = {}; rows.forEach((r) => { const c = a2(r.k); if (c) m[c] = (m[c] || 0) + n(r[key]); }); return m; };

/* ---------- markets ---------- */
export function Markets({ d, days }: { d: D; days: number }) {
  const { set } = useFlt();
  const M = useRpc("admin_markets", { p_days: days || 3650 }, [days]);
  const X: D = (M.d as D) || {};
  const langs = ((d.langs || []) as D[]).filter((x) => x.k && x.k !== "?" && n(x.n) > 0);
  const acc = new Map(((X.acc_langs || []) as D[]).map((x) => [String(x.k).slice(0, 2), n(x.n)]));
  const pts = langs.map((x) => ({ k: x.k, l: lang(x.k), x: n(x.n), y: n(x.scored) / Math.max(1, n(x.n)), r: 4 + Math.sqrt(n(x.scored)) * 1.6 }));
  const best = [...pts].filter((p) => p.x >= 10).sort((a, b) => b.y - a.y)[0];
  const gsc = useMemo(() => toMap(X.gsc, "clicks"), [X.gsc]);
  const apple = useMemo(() => toMap(X.apple_dl), [X.apple_dl]), play = useMemo(() => toMap(X.play_dl), [X.play_dl]);
  const dl = useMemo(() => { const m = { ...apple }; Object.entries(play).forEach(([k, v]) => (m[k] = (m[k] || 0) + v)); return m; }, [apple, play]);
  const imp = useMemo(() => toMap(X.apple_imp), [X.apple_imp]), pv = useMemo(() => toMap(X.apple_pv), [X.apple_pv]);
  const aud = useMemo(() => toMap(X.audience), [X.audience]);
  const land = langLand(langs);
  const [mode, setMode] = useState<"lang" | "gsc" | "dl" | "imp" | "aud">("lang");
  const vals = mode === "lang" ? land : mode === "gsc" ? gsc : mode === "dl" ? dl : mode === "imp" ? imp : aud;
  const lbl = { lang: "látogatás", gsc: "Google-kattintás", dl: "letöltés", imp: "App Store-megjelenés", aud: "követő / néző" }[mode];
  const empty = !Object.keys(vals).length;
  const note = { lang: "", gsc: "A Google Search Console bekötése után jelennek meg az országok.", dl: "Az App Store Connect (sales) és a Google Play-jelentések bekötése után jelennek meg a letöltések.", imp: "Az App Store Connect-analitika bekötése után jelenik meg.", aud: "A platformok közül az Instagram és a YouTube adja ki a közönség országát; a többi bekötése után, ha az API engedi." }[mode];
  /* one row per country: every source side by side */
  const matrix = useMemo(() => {
    const keys = new Set([...Object.keys(gsc), ...Object.keys(apple), ...Object.keys(play), ...Object.keys(imp), ...Object.keys(aud), ...Object.keys(land)]);
    return [...keys].map((c) => ({ c, name: countryName(c), gsc: gsc[c] || 0, apple: apple[c] || 0, play: play[c] || 0, imp: imp[c] || 0, pv: pv[c] || 0, aud: aud[c] || 0, lang: land[c] || 0 }))
      /* a country only from the language guess (French → twenty African countries, each ~0) is noise: it needs a measured number */
      .filter((r) => r.gsc + r.apple + r.play + r.imp + r.pv + r.aud > 0 || r.lang >= 1)
      .sort((a, b) => b.gsc + b.apple + b.play + b.aud / 100 + b.lang - (a.gsc + a.apple + a.play + a.aud / 100 + a.lang));
  }, [gsc, apple, play, imp, pv, aud, land]);
  const plats = Array.from(new Set(((X.audience || []) as D[]).map((x) => x.platform)));
  return (
    <div className="g">
      <Band plain label={`Nyelvek ${periodName(d)}`} value={langs.length} unit="nyelven jöttek látogatók" sentence={<>{langs[0] ? <>A legnagyobb piac: <b>{lang(langs[0].k)}</b> ({fmt(langs[0].n)} látogatás). </> : null}{best ? <>A legjobban konvertáló (legalább 10 látogatással): <b>{best.l}</b>, {fmt(best.y * 100, 1)}% jut el az előnézetig.</> : null} Egy nyelvre kattintva a szűrő arra a nyelvre áll; a szűrőt követő oldalak (Áttekintés, Források, Tölcsér, Használat, Megtartás) annak számait mutatják. {d.filter?.from ? "Egyedi időszaknál a látogatások a választott napokat mutatják, a fiókok, a Google és az áruházak blokkjai viszont a kezdőnaptól máig számolnak." : "Minden blokk ugyanazt az időszakot mutatja."} A látogatás nyelve az, amelyiken véget ért (az első esemény még a nyelv beállítása előtt indul).</>} />
      <Card className="s12" icon={P.globe} src={["gsc", "apple", "google"]} title="Hol vannak" sub="Nyelvek: a látogatások nyelve zászlóval (országot az események nem tárolnak). Google: kattintás országonként. Letöltés: App Store és Google Play együtt. Megjelenés: az App Store-ban, országonként. Közönség: a platformok követői / nézői országonként."
        right={<div className="adm-seg sm">{([["lang", "Nyelvek"], ["gsc", "Google"], ["dl", "Letöltés"], ["imp", "App Store-megjelenés"], ["aud", "Közönség"]] as const).map(([k, l]) => <button key={k} aria-pressed={mode === k} onClick={() => setMode(k)}>{l}</button>)}</div>}>
        {mode === "lang" ? <LangCards langs={langs} onPick={(k) => set({ lang: k })} max={12} /> : <div className="mapgrid">
          <WorldMap values={vals} label={lbl} note={empty ? note : undefined} />
          {empty ? <Empty t={note} icon={P.globe}><a className="adm-ibtn gold" href="#connect">Bekötés</a></Empty> : <CountryList values={vals} label={lbl} max={9} />}
        </div>}
      </Card>
      <Card className="s8" icon={P.target} title="Méret × konverzió" sub="Vízszintesen a látogatások száma (logaritmikus), függőlegesen hány % jut el az előnézetig; a buborék mérete az előnézetek száma. Jobbra fent: nagy és jól konvertáló piac, ide érdemes több tartalom.">
        {pts.length ? <Scatter pts={pts} xl="Látogatás" yl="Előnézetig" /> : <Empty t="Még nincs elég adat." ghost />}
      </Card>
      <Card className="s4" icon={P.globe} title="Nyelvek" sub="Látogatás, előnézet és új fiók nyelvenként (a fióknál a fiók nyelve, Google- és Apple-fióknál a regisztráló látogatásé)."><BarList items={langs.map((x) => ({ k: x.k, n: n(x.n), sub: `${fmt(x.scored)} előnézet · ${pct(n(x.scored), n(x.n))} · ${fmt(acc.get(String(x.k).slice(0, 2)) || 0)} új fiók` }))} fmtK={(k) => `${flag((LANG_LAND[k] || [])[0])} ${lang(k)}`} max={12} accent onPick={(k) => set({ lang: k })} /></Card>
      <Card className="s12" icon={P.layers} src={["gsc", "apple", "google"]} title="Országok egy sorban" sub="Minden forrás országonként, egymás mellett: Google-kattintás, App Store- és Google Play-letöltés, App Store-megjelenés és termékoldal-megtekintés, a platformok közönsége, és a látogatások nyelve (becslés: a nyelvet azokra az országokra festjük, ahol beszélik).">
        <Tbl name="orszagok" rows={matrix} empty="Még nincs országos adat." cols={[
          { k: "name", l: "Ország", r: (r) => <span>{flag(r.c)} {r.name}</span> },
          { k: "gsc", l: "Google-kattintás", num: true, r: (r) => fmt(r.gsc) }, { k: "apple", l: "App Store-letöltés", num: true, r: (r) => fmt(r.apple) },
          { k: "play", l: "Play-telepítés", num: true, r: (r) => fmt(r.play) }, { k: "imp", l: "App Store-megjelenés", num: true, r: (r) => fmt(r.imp) },
          { k: "pv", l: "Termékoldal", num: true, r: (r) => fmt(r.pv) }, { k: "aud", l: "Közönség", num: true, r: (r) => fmt(r.aud) },
          { k: "lang", l: "Nyelv (becslés)", num: true, r: (r) => fmt(r.lang) },
        ]} />
      </Card>
      {plats.length > 0 && <Card className="s12" icon={P.globe} src={["tiktok", "instagram", "facebook", "pinterest", "linkedin", "youtube"]} title="A közönséged országai a platformokon" sub="A követők és nézők országa, ahogy a platform kiadja (platformonként egyszer). A TikTok, a Facebook, a Pinterest és a LinkedIn ezt a mostani bekötéssel nem adja ki, ezért ott nem jelenik meg.">
        <div className="demo-cols">{plats.map((p) => <div key={p}><h4>{PF[p] || p}</h4><BarList items={((X.audience || []) as D[]).filter((x) => x.platform === p).map((x) => ({ k: a2(x.k) || x.k, n: n(x.n) }))} fmtK={(k) => `${flag(k)} ${countryName(k)}`} max={8} accent /></div>)}</div>
      </Card>}
    </div>
  );
}
