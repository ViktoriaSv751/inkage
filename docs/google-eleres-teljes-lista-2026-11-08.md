# InkAge – minden, amivel sokkal jobb Google-helyezést és nagyobb elérést érhetünk el

Készült: 2026-11-08, a Search Console adatai alapján (10-19 – 11-05: 66 kattintás, 7,77 ezer megjelenés, átlagos pozíció 14,2; utolsó 24 óra: 10 kattintás, 537 megjelenés).
Nincs benne az, ami ma már elkészült (lásd a végén). Szabályok: csak organikusan, fizetett hirdetés nélkül. Az „ingyenes” vagy „free” szó nem szerepelhet. Kifelé semmi nem megy ki Viktória jóváhagyása nélkül.

Jelölések: ⚡ gyors (1 nap alatt megvan), 🔧 fejlesztés, ✍️ tartalom, 🤝 külső munka, Viktória kell hozzá.
Hatás: ★★★ nagy, ★★ közepes, ★ kicsi.

---

## 1. Technikai SEO (az alap, nélküle a tartalom sem hat)

1. ⚡🔧 ★★ **Borítókép alt szövege.** A cikkek borítóképén most `alt=""` van. A tetoválás vizuális téma, a Google Képek komoly forgalmat hozhat. A borítókép alt szövege legyen a cikk címe, vagy egy rövid képleírás.
2. 🔧 ★★ **Kép-sitemap és ImageObject.** A cikkek illusztrációi kerüljenek be a sitemapbe `<image:image>` bejegyzésként, és a strukturált adatokba is, hogy a Képek keresőben is megjelenjenek.
3. ⚡🔧 ★★ **A sitemap felosztása.** Most egyetlen, kb. 10 MB-os fájl, kb. 2 800 címmel. Legyen sitemap-index, típusonként és nyelvenként külön fájlokkal (cikkek, /tattoo oldalak, statikus oldalak). Így a GSC-ben látszik, melyik csoportnak mekkora része van indexelve.
4. 🔧 ★★★ **A /tattoo programozott oldalak minősége.** 80 stílus–testrész oldal létezik × 35 nyelv. Ha a szövegük nagyrészt sablon, a Google „vékony tartalomnak” tekintheti őket, ami az egész domaint lehúzhatja. Teendők:
   - mindegyik kapjon egyedi, adatra épülő bekezdéseket: a fájdalom szintje az adott helyen, a tipikus méret, hogyan öregszik az adott helyen, hány év után kell javítás;
   - ahol nincs fordítás, kapjon noindex jelölést (mint a cikkeknél);
   - a nem keresett kombinációkat (például realism–finger) vegyük ki az indexből.
5. ⚡ ★★ **Bing Webmaster Tools és IndexNow.** A Calligránál már megvan, az InkAge-nél még nem. Ezzel a Bing, a DuckDuckGo és a Yahoo gyorsabban indexel.
6. ⚡ ★★ **Seznam (Csehország).** A legtöbb megjelenésünk cseh keresésekből jön, ott a Seznam is erős kereső. A Seznam Webmaster beállítása a Calligrás mintára mehet.
7. 🔧 ★ **Naver (Korea) és Yandex.** Csak akkor, ha a koreai vagy orosz tartalom bővül.
8. 🔧 ★★ **Core Web Vitals a cikkoldalakon.** A főoldal mobilon 93–99 pontos, a cikkoldalakat még nem mértük. Mérjük meg a PageSpeed-del, főleg a betűtípus és a borítókép miatt.
9. 🔧 ★ **Belső 404-ek és átirányítások.** Havonta egyszer nézzük át a GSC „Oldalak” jelentését (nem talált, átirányított, duplikált oldalak).
10. 🔧 ★★ **Hreflang-ellenőrzés.** Az elrontott `?lang=` linkek most már a jó nyelvre irányítanak, de érdemes egy crawlerrel (például Screaming Frog, max. 500 címig) egyszer végigmenni a hreflang-párokon.
11. 🔧 ★ **Dátumok.** Ha egy cikket érdemben frissítünk, a `dateModified` értéke is változzon. A Google a friss tartalmat előnyben részesíti az árakat és szabályokat érintő témáknál.

## 2. Kattintási arány (CTR): ugyanabból a helyezésből több látogató

12. ⚡✍️ ★★★ **Havi címfrissítés.** Minden hónapban vegyük elő a GSC-ből azokat az oldalakat, amelyek az 5–20. helyen sok megjelenést kapnak, de kevés kattintást, és írjuk át a címüket a tényleges keresésekre. Ma 25 oldal-nyelv kapott ilyen címet. A címekben működik: szám („10, 20, 30 év”), kérdés („Masakit ba…?”), és a keresett kifejezés szó szerint.
13. ✍️ ★★ **Meta leírások.** Ma csak a címek változtak. A leírás kezdődjön a válasszal (például „6–12 alkalom, átlagosan…”), a végén álljon egy ok a kattintásra („árak méret szerint”).
14. 🔧 ★ **A márka a cím végén.** Az angol oldalakon maradjon „– InkAge”, mert ez segíti a márkaismertséget. A hosszú helyi címekből hagyjuk el.
15. ⚡ ★★ **A kínai tudástár (`/tudastar?lang=zhs`).** Ez kapta a legtöbb megjelenést (1 980) az 5,5. helyen, 0 kattintással. Ma új címet kapott. Ha 2 hét múlva sincs kattintás, nézzük meg, milyen kérdésre jelenik meg (valószínűleg a Képek keresőben), és ahhoz igazítsuk.

## 3. Tartalom: témák, amelyekben első helyre kerülhetünk

### 3.1 Témacsoportok (hub + kapcsolódó cikkek)
16. ✍️ ★★★ **Eltávolítás.** Már 6 cikk szól róla, és innen jön a legtöbb megjelenés. Ami hiányzik:
    - fájdalom eltávolításkor (cs)
    - színes festék eltávolítása (piros, kék, zöld)
    - eltávolítás sötét bőrön
    - halványítás cover-up előtt
    - eltávolítás terhesség vagy szoptatás alatt
    - eltávolító krémek (miért nem működnek)
    - otthoni eltávolítás veszélyei
    - szemöldök és smink-tetoválás eltávolítása
17. ✍️ ★★★ **Stílusok.** Ma elkészült a hub és két stílus. Ami hiányzik:
    - fine line (külön a betűkről, script)
    - minimalista vagy mikro tetoválás
    - japán stílus
    - watercolour
    - dotwork és geometrikus
    - neo-traditional
    - tribal
    - fehér festék
    - UV festék
    - stick and poke

    Mindegyik a 10/20/30 éves öregedésre épüljön, ez a mi saját szögünk.
18. ✍️ ★★★ **Testrészek.** A /tattoo oldalakon már látszik keresés (blackwork nyak es/pt, a 7–10. helyen). Kellene egy-egy hosszú cikk a legnagyobbakról:
    - nyak
    - kézfej és ujj
    - borda
    - boka
    - térd belső oldala
    - fül mögött
    - könyök

    Mindegyikben: fájdalom, öregedés, ára, mire figyelj.
19. ✍️ ★★ **Gyógyulás és utókezelés.** Hiányzik:
    - viszketés
    - hámlás
    - kidudorodó tetoválás
    - fertőzés jelei
    - edzés tetoválás után
    - úszás tetoválás után
    - alkohol előtte és utána
    - második bőr fólia (Saniderm)
20. ✍️ ★★ **Döntés előtt.** Hiányzik:
    - első tetoválás ötletek
    - páros tetoválás
    - emléktetoválás
    - név tetoválása (megbánás)
    - tetoválás állásinterjún vagy munkahelyen
    - korhatár országonként
    - tetoválás és véradás
    - tetoválás és MRI
21. ✍️ ★★ **Árak.** Mennyibe kerül egy tetoválás méret, ország és stílus szerint. Ugyanaz a modell, mint a mai eltávolítási árcikk, helyi pénznemekkel.

### 3.2 Linket vonzó tartalmak és eszközök (ezekre szívesen linkelnek mások)
22. 🔧 ★★★ **Interaktív fájdalomtérkép.** A meglévő cikk mellé egy kattintható testtérkép, minden testrészhez fájdalomszinttel és öregedési értékkel. Beágyazható kóddal, forrásmegjelöléssel („embed”), így a blogok átveszik, és visszalinkelnek.
23. 🔧 ★★★ **Eltávolítási árkalkulátor.** Méret, szín, ország → hány alkalom kell, és mennyibe kerül összesen. Erre a keresésre van a legtöbb cseh, holland és svéd megjelenésünk.
24. 🔧 ★★ **Méretkalkulátor.** Testrész és minta → mekkora legyen, hogy 20 év múlva is olvasható maradjon.
25. ✍️ ★★★ **Saját adat, sajtónak.** Az InkAge előnézetekből anonim összesítés: a legnépszerűbb testrészek, stílusok, méretek országonként. Például: „A cseh felhasználók 38%-a az alkarra tervez”. Évente kétszer, sajtóközleménnyel. Ez a legerősebb linkszerző módszer. **Ehhez az adatvédelmi szöveget ellenőrizni kell, és csak összesített adatot szabad közölni.**
26. ✍️ ★★ **Szakértői kérdőív.** 20–30 tetoválóművész válaszol 5 kérdésre (például „melyik stílus öregszik a legjobban?”). Az eredményből cikk lesz, és a művészek megosztják.
27. ✍️ ★ **Szószedet.** Blowout, cover-up, flash, linework, whip shading, picosecond stb. Rövid, egymásra linkelő definíciók. A Google gyakran ilyen oldalakat emel ki a válaszaiban.

### 3.3 Hitelesség (E-E-A-T: a Google ezt különösen nézi az egészséget érintő témáknál)
28. ✍️ ★★★ **Szakmai lektor.** Legyen egy tetoválóművész vagy bőrgyógyász, aki átnézi a cikkeket. A cikk alján: „Szakmailag ellenőrizte: [név], [szerep]”, saját profiloldallal. Az eltávolítási, festékbiztonsági és gyógyulási cikkeknél ez komoly rangsorolási előny.
29. ✍️ ★★ **Források a cikkek alján.** Például: EU REACH rendelet, RIVM, BfR, tanulmányok. A szöveg csak félkövért tud, ezért kell egy külön „Források” blokk a cikk adatai között.
30. ✍️ ★★ **Szerkesztőségi oldal.** Ki írja a cikkeket, hogyan ellenőrizzük a tényeket, hogyan frissítünk. Az „InkAge szerkesztőség” legyen kattintható, és mutasson erre az oldalra.
31. ✍️ ★★ **Valódi fotók engedéllyel.** A felhasználók (hozzájárulással) vagy együttműködő stúdiók gyógyult és 10 éves tetoválásairól. A rajzolt illusztráció jó, de a valódi „előtte–utána” fotó erősebb a Képek keresőben és a bizalomban is.

### 3.4 Frissítés és karbantartás
32. ✍️ ★★ **Negyedéves frissítés.** Az árakat, szabályokat és számokat tartalmazó cikkeket háromhavonta nézzük át, és a dátum is frissüljön.
33. ✍️ ★ **Összevonás.** Ha két cikk ugyanarra a keresésre versenyez (például before-and-after és tattoos-when-you-get-old), az egyik kapjon más fókuszt, vagy vonjuk össze, és a régi címe irányítson át.

## 4. Nyelvek és piacok (oda fókuszáljunk, ahol már van kereslet)

34. ★★★ **Elsődleges piacok az adatok alapján:**
    - cseh (eltávolítás)
    - holland (eltávolítás, inktpaspoort)
    - svéd, norvég, dán (eltávolítás, fine line, stílusok)
    - spanyol és portugál (blackwork, realizmus, előtte–utána)
    - filippínó (fájdalom)
    - finn (előtte–utána)
    - angol

    Az új cikkek ezekre a nyelvekre készüljenek először, ne mind a 35-re.
35. ✍️ ★★★ **Anyanyelvi átnézés.** A fordítások gépi és MI-alapúak. Egy anyanyelvi lektor 1–2 órája piaconként (például Fiverr vagy egyetemi hallgató) lényegesen javít a minőségen. Elsőként a cseh, a holland és a svéd jöjjön.
36. ✍️ ★★ **Helyi adatok.** A helyi árak, szabályok (cseh, svéd, holland hatóság), korhatár és helyi kifejezések teszik a fordítást helyi tartalommá. Ezt a gépi fordítás nem adja meg.
37. ✍️ ★★ **Helyi kérdésformák.** A „kolik sezení”, „masakit ba”, „ervaringen” típusú kérdések szó szerint jelenjenek meg a címekben és a GYIK-ben.

## 5. Külső linkek (ez emel a 14. helyről az első 5 közé)

Részletes terv és sablonok: `docs/kulso-linkek-2026-11-08.md`. Röviden:

38. 🤝 ★★ **Katalógusok.**
    - AI-katalógusok: RankMyAI, AIChief, aisotools, Futurepedia, There's An AI For That, SaaSHub
    - egyéb: AlternativeTo, PeerPush, Product Hunt
39. 🤝 ★★★ **Digitális PR.** A 25. és 26. pont adattörténetei kerüljenek tetoválós, életmód- és egészségmagazinokhoz. Szakértői válaszokat kérő platformok: Qwoted, Featured.com, SourceBottle. Viktória ott tetoválás-öregedési szakértőként válaszolhat.
40. 🤝 ★★★ **Tetoválóstúdiók.** Ajánlat: „tedd ki a weboldaladra az InkAge előnézet-linket vagy a fájdalomtérképet”. Cserébe a stúdió neve megjelenhet egy „partnerstúdiók” oldalon. Kezdetnek a cseh, holland és svéd stúdiók.
41. 🤝 ★★ **Utókezelési márkák és bőrgyógyászok blogjai.** Vendégcikk vagy szakértői idézet, például „hogyan hat a nap a tetoválásra”.
42. 🤝 ★★ **Reddit és Quora.** Hetente 3–5 hasznos válasz, a Calligrás módszerrel (1 link, 1 név, 1 semmi). Releváns subredditek: r/tattoos, r/tattooadvice, r/TattooRemoval, r/tattoo.
43. 🤝 ★ **Fórumok.** Helyi fórumok a fő piacokon: cseh (eMimino, Modrý koník), holland (Viva Forum), svéd (Familjeliv, Flashback).
44. 🤝 ★ **Wikidata.** Az InkAge saját Wikidata-elemet kapjon, mint a Calligra (Q141918137). Ez segít a Google Tudáspanelben és az MI-asszisztenseknél.

## 6. Közösségi média → márkakeresés → Google

A Google figyeli, hányan keresnek rá a márkanévre. Ma az „inkage tattoo” keresés 19 megjelenést kapott.

45. ✍️ ★★★ **Előtte–utána videó a saját eszközzel.** „Így néz ki a tetoválásod 70 évesen” típusú TikTok, Reels és Shorts videók, valódi előnézettel. Ez az InkAge legvirálisabb formátuma. A szöveg végén szerepeljen a név („search InkAge”), mert a bio-link nem kattintható.
46. ✍️ ★★ **YouTube.** Csatorna Shorts-videókkal és 3–5 hosszabb videóval (például „tattoo removal cost explained”). A YouTube-videók a Google-találatokban is megjelennek.
47. ✍️ ★★ **Pinterest.** Tábla minden témacsoportnak, pinek a cikkekre, napi 2–3. A tetoválás a Pinterest egyik legnagyobb kategóriája.
48. 🔧 ★★ **Megosztás vízjellel.** Az InkAge előnézet képének sarkában álljon kicsiben, hogy „inkage.app”, a megosztás pedig a cikkhez vagy a főoldalhoz vigyen. Minden megosztás reklám és márkakeresés.
49. ✍️ ★ **Lili-sorozat.** Az utolsó dia mutassa a keresést („Google: InkAge”), ne csak a linket.

## 7. MI-keresők (ChatGPT, Perplexity, Gemini, Google AI-áttekintés)

50. 🔧 ★★ **llms.txt.** Kerüljön bele mind a 31 cikk és az eszközök rövid leírása.
51. ✍️ ★★ **Válasz az első bekezdésben.** Minden cikk az első 2 mondatban adjon számszerű választ (az „In short” blokk már megvan, a bevezető is ezzel kezdődjön). Az MI-keresők ezt idézik.
52. 🤝 ★★ **Említés harmadik helyeken.** Reddit, Quora, katalógusok, sajtó. Az MI-asszisztensek onnan „tudják”, hogy létezünk.
53. ⚡ ★ **Mérés.** Havonta 10 kérdés a négy MI-ben (például „app to see how my tattoo will age”), és feljegyezzük, ajánlják-e az InkAge-et.

## 8. Alkalmazásboltok (ASO, az is keresés)

54. ✍️ ★★ **Kulcsszavak az App Store és a Play áruházban.** Például: tattoo aging, tattoo simulator, tattoo preview, tattoo removal. Helyi kifejezésekkel, a fő piacokon is.
55. ✍️ ★★ **Képernyőképek.** Előtte–utána szöveggel, minden fő piac nyelvén.
56. 🤝 ★★ **Értékelések.** Kérés az előnézet után, a jó élmény pillanatában, nem az elején.

## 9. Konverzió: a Google-ös látogatóból regisztráló legyen

57. 🔧 ★★★ **Cikkenként személyre szabott ajánlat.**
    - Eltávolítási cikk: „nézd meg, hogyan halványul a tiéd alkalmanként”.
    - Stíluscikk: „nézd meg ezt a stílust a saját bőrödön”.
    - Most a legtöbb cikk ugyanazt az általános ajánlatot mutatja.
58. 🔧 ★★ **Mérés.** 11-14 körül hasonlítsuk össze a `cta_click` és az `article` adatokat (a cikkgombok óta). Nézzük meg, melyik helyen és cikkben kattintanak a legtöbben.
59. 🔧 ★★ **Kép a cikk közepén.** Statikus előtte–utána kép, ami „a te fotóddal is működik” ajánlattal visz tovább.

## 10. Mérés és rutin

60. ⚡ **Hetente (hétfőn, 15 perc):**
    - GSC 7 nap: kattintás, megjelenés, pozíció;
    - az 5 legnagyobb új keresés;
    - az indexelési kérések (napi kb. 10).
61. ⚡ **Havonta:**
    - címfrissítés (12. pont);
    - témaréses lista frissítése (milyen keresésre jelenünk meg cikk nélkül);
    - 404-ek;
    - MI-láthatóság (53. pont).
62. ⚡ **Célok:**
    - 12-01-ig: napi 15 kattintás, átlagos pozíció 12 alatt.
    - 2027-01-01-ig: napi 50 kattintás, legalább 30 kulcsszó az első 3 között.

## 11. Javasolt sorrend

**Ezen a héten:**
- 1, 3, 5, 6 (gyors technikai lépések)
- 38 (katalógusok)
- 45 (az első 3 előtte–utána videó)

**November:**
- 4 (/tattoo oldalak)
- 16, 17 (eltávolítás és stílusok, 4–6 új cikk)
- 22, 23 (fájdalomtérkép és árkalkulátor)
- 28 (lektor)
- 35 (anyanyelvi átnézés: cs, nl, sv)
- 42 (heti Reddit és Quora)

**December:**
- 25 (saját adat + sajtó)
- 39, 40 (PR és stúdiók)
- 18 (testrész-cikkek)
- 46 (YouTube)
- 57 (személyre szabott ajánlat)

**Folyamatosan:** 12, 32, 60, 61.

---

### Ami 2026-11-08-án már elkészült (seo-boost ág)
- A `/app/tudastar/...` duplikátumok canonicalja a nyilvános cikkre mutat, a többi app-oldal noindexet kapott.
- Az elrontott `?lang=` címek 308-as átirányítással mennek a jó nyelvre.
- A címek végéről lekerült a magyar „InkAge Tudástár” utótag.
- 25 oldal-nyelv kapott keresésre írt címet (`lib/seo-titles.ts`).
- A cikkek BreadcrumbList strukturált adatot kaptak.
- Hat új cikk készült, saját rajzolt képekkel, 10–13 nyelven: tattoo-styles-guide, realism-tattoos-aging, american-traditional-tattoo-aging, how-to-book-a-tattoo, laser-tattoo-removal-cost (helyi árakkal), tattoo-ink-safety-eu (inktpaspoort).
- A külső linkek terve és sablonjai elkészültek (`docs/kulso-linkek-2026-11-08.md`).
