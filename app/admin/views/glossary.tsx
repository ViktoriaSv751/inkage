"use client";
import { useState } from "react";
import { ALL, Card, P, type Tab } from "../shared";

/* ---------- Szótár: every number of the dashboard, defined once ----------
   What it counts, where it comes from, how fresh it is, and where it shows. One place, so a number means the same on
   every page. Add a term here when a page gets a new kind of number. */
type Term = { t: string; g: string; def: string; src: string; fresh?: string; where: Tab[]; not?: string };
const G = ["Látogatás és tölcsér", "Közösségi oldalak", "Google és keresők", "Áruházak", "Fiókok és megtartás", "Számítás"];
const TERMS: Term[] = [
  { g: G[0], t: "Látogatás (munkamenet)", def: "Egy ember egy látogatása a inkage.app-n vagy az appban: az első eseménytől addig, amíg ugyanabban a böngészőlapban marad. Egy ember több látogatást is tehet.", src: "Saját mérés (névtelen események)", fresh: "azonnal", where: ["home", "traffic", "funnel", "live"], not: "Nincs benne: robotok, sebességmérők, tesztek, a saját eszközeid (Monitoring → Adatminőség)." },
  { g: G[0], t: "Valódi látogató", def: "A látogatások azon része, ami valódi embertől jön. A robotokat, a tesztlinkeket és a saját eszközeidet a rendszer óránként kiszűri, és ezek sehol nem számítanak.", src: "events_real nézet", fresh: "óránként", where: ["home", "system", "monitor"] },
  { g: G[0], t: "Előnézet (kész előnézet)", def: "Egy látogatás, amelyben az ember megkapta a tetoválás előnézetét a saját bőrén. Ez az app fő élménye, ezért az 1 milliós cél is erre épül.", src: "Saját mérés", fresh: "azonnal", where: ["home", "funnel", "goals"] },
  { g: G[0], t: "Megnézte 50 év múlva", def: "A látogatás, amelyben megnézte, hogyan öregszik a tetoválás 50 év alatt.", src: "Saját mérés", where: ["funnel", "product"] },
  { g: G[0], t: "Megosztás", def: "A látogatás, amelyben megosztott egy linket, vagy elmentett egy öregedés-videót, PDF-et a tetoválóművésznek.", src: "Saját mérés", where: ["viral", "funnel"] },
  { g: G[0], t: "Csatorna", def: "Honnan jött a látogatás: a rövid link (inkage.app/go/…), az utm-címke, a hivatkozó oldal vagy az alkalmazáson belüli böngésző (TikTok, Instagram) alapján. Aki már járt itt, és magától jön vissza (könyvjelző, kezdőképernyő), az „Visszatérő látogató”; ami így sem dönthető el, az „Közvetlen / ismeretlen”. Robotok, sebességmérés és az áruházak ellenőrzői (akik csak az Adatvédelem / Fiók törlése oldalt nyitják meg) egyik számban sincsenek benne.", src: "Saját mérés", where: ["traffic", "home"] },
  { g: G[0], t: "Konverzió", def: "Két lépés aránya, pl. hány látogatásból lett előnézet. Mindig ugyanannak az időszaknak a látogatásaira számoljuk.", src: "Számítás", where: ["funnel", "traffic", "markets"] },
  { g: G[1], t: "Megtekintés", def: "Hányszor nézték meg a posztot. TikTokon és YouTube-on lejátszás, Instagramon és Facebookon a Meta „views” száma (2025 óta ez váltotta a megjelenést).", src: "A platform API-ja", fresh: "óránként", where: ["social", "impressions", "platforms"] },
  { g: G[1], t: "Megjelenés", def: "Hányszor jelent meg a poszt valakinek, akár megnézte, akár nem. Pinterest és LinkedIn ezt adja; a megtekintéssel nem adjuk össze, mert más a mértékegység.", src: "A platform API-ja", fresh: "óránként (Pinterest napi bontás)", where: ["social", "impressions"] },
  { g: G[1], t: "Elérés", def: "Hány különböző ember látta a posztot vagy a fiókot. Az Elérés platformonként táblázatban az „Elérés” gomb a platform fő számát mutatja: megtekintést vagy megjelenést.", src: "A platform API-ja", where: ["social", "impressions"] },
  { g: G[1], t: "Gyűjtött megtekintés (időszakban)", def: "Amit a posztok az adott napokon gyűjtöttek: a napi pillanatképek különbsége. A ≥ jel: legalább ennyi, mert egy régebbi posztnak még nincs olyan régi pillanatképe.", src: "Napi és óránkénti pillanatképek", fresh: "óránként", where: ["social", "impressions", "platforms"] },
  { g: G[1], t: "Elköteleződés", def: "(kedvelés + komment + megosztás + mentés) ÷ megtekintés. A megjelenést számoló platformok kimaradnak belőle, hogy egy mértékegység legyen.", src: "Számítás", where: ["social", "platforms"] },
  { g: G[1], t: "× medián", def: "A poszt megtekintése osztva a platformod összes posztjának medián megtekintésével (a poszt maga nélkül). 2× = kétszer olyan jól ment, mint a szokásos. A 24 óránál fiatalabb poszt még nem kap szorzót.", src: "Számítás", where: ["social", "home"] },
  { g: G[1], t: "Látogató / 1000 megtekintés", def: "Hány látogatót hozott egy poszt vagy platform 1000 megtekintésenként. Ez mutatja, mi hoz tényleg embert, nem csak nézőt.", src: "Számítás (rövid link + platform)", where: ["social", "platforms"] },
  { g: G[1], t: "Kézzel felvett poszt", def: "Egy be nem kötött platform posztja, amit a linkjével vettél fel. A számai addig a te beírásodból jönnek; bekötéskor a valódi poszt átveszi a helyét.", src: "Kézi bevitel", where: ["social"] },
  { g: G[1], t: "Követő", def: "A fiók követőinek száma az adott napon; a változás a hét nappal korábbi naphoz mér.", src: "A platform API-ja", fresh: "óránként", where: ["audience", "social"] },
  { g: G[2], t: "Google-megjelenés", def: "Hányszor jelent meg a inkage.app a Google találatai között.", src: "Google Search Console", fresh: "naponta, 2–3 nap késéssel", where: ["search", "impressions"] },
  { g: G[2], t: "Google-kattintás és CTR", def: "Hányszor kattintottak a találatra, és ez a megjelenések hány százaléka (kattintási arány).", src: "Google Search Console", fresh: "naponta, 2–3 nap késéssel", where: ["search"] },
  { g: G[2], t: "Átlagos helyezés", def: "A találat átlagos helye a Google-ben (1 = első). A kisebb szám jobb.", src: "Google Search Console", where: ["search", "seo"] },
  { g: G[2], t: "Bing", def: "Ugyanezek a Bing keresőből.", src: "Bing Webmaster Tools", fresh: "naponta, 1–2 nap késéssel", where: ["seo", "impressions"] },
  { g: G[3], t: "Letöltés", def: "Az app első letöltései az App Store-ból és a Google Playből (frissítés nélkül).", src: "App Store Connect, Google Play Console", fresh: "naponta, 1–2 nap késéssel", where: ["stores"] },
  { g: G[3], t: "Értékelés", def: "A csillagok átlaga és a vélemények száma áruházanként.", src: "Áruházak", where: ["stores", "inbox"] },
  { g: G[4], t: "Fiók (regisztráció)", def: "Egy valódi felhasználói fiók. A teszt-, a saját és az áruházi ellenőrző fiókok nem számítanak.", src: "Bejelentkezési rendszer", fresh: "azonnal", where: ["users", "home"] },
  { g: G[4], t: "Aktív fiók", def: "Fiók, amely az adott napon (DAU), héten (WAU) vagy 30 napon belül (MAU) használta az appot.", src: "Saját mérés", where: ["retention"] },
  { g: G[4], t: "Kohorsz", def: "Az egy héten regisztráltak csoportja; megmutatja, közülük hányan jönnek vissza a következő hetekben.", src: "Számítás", where: ["retention"] },
  { g: G[5], t: "Időszak", def: "A fejlécben választott napok (ma, 3, 7, 30, 90 nap, összes, saját). A Google, a YouTube és az áruházak egész napokat adnak késéssel: náluk egy hétnél rövidebb időszak helyett 7 nap látszik, és ezt egy sor jelzi.", src: "Fejléc", where: ["home"] },
  { g: G[5], t: "Változás (↑ ↓ %)", def: "Az előző, ugyanilyen hosszú időszakhoz képest. Az Időszak menüben kikapcsolható.", src: "Számítás", where: ["home"] },
  { g: G[5], t: "Szűrő (csatorna, nyelv)", def: "Csak az adott csatornáról vagy nyelvről jött látogatások számai. Több csatorna is választható egyszerre. A posztok, a követők, a Google és az áruházak nem szűrhetők így.", src: "Fejléc", where: ["home", "traffic"] },
  { g: G[5], t: "Frissesség", def: "A kártyák tetején a pötty: zöld, ha a forrás a szokásos időn belül frissült, sárga, ha régebben. Rámutatva a pontos idő.", src: "Lehúzások naplója", where: ["monitor"] },
];

export function Glossary({ go }: { go: (t: Tab) => void }) {
  const [q, setQ] = useState("");
  const ql = q.trim().toLowerCase();
  const list = TERMS.filter((x) => !ql || (x.t + " " + x.def + " " + (x.not || "")).toLowerCase().includes(ql));
  return (
    <div className="g">
      <section className="c s12"><span className="eyebrow">Szótár</span><h2 style={{ margin: "6px 0 4px" }}>Minden szám, egy helyen</h2>
        <p className="note">Mit számol, honnan jön, mennyire friss, és hol látod. Minden oldal ugyanezt a meghatározást használja.</p>
        <input className="adm-in" type="search" placeholder="Keresés: pl. megjelenés, elköteleződés, kohorsz…" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginTop: 10 }} aria-label="Keresés a szótárban" />
      </section>
      {G.map((g) => { const ts = list.filter((x) => x.g === g); if (!ts.length) return null;
        return (
          <Card key={g} className="s12" icon={P.doc} title={g}>
            <dl className="gls">{ts.map((x) => (
              <div key={x.t} className="gls-i">
                <dt>{x.t}</dt>
                <dd><p>{x.def}</p>{x.not && <p className="mut">{x.not}</p>}
                  <p className="gls-m"><span className="chip">Forrás: {x.src}</span>{x.fresh && <span className="chip">Frissül: {x.fresh}</span>}{x.where.map((w) => <button key={w} className="lnk" onClick={() => go(w)}>{ALL.find((y) => y.k === w)?.l || w} →</button>)}</p></dd>
              </div>))}</dl>
          </Card>
        ); })}
    </div>
  );
}
