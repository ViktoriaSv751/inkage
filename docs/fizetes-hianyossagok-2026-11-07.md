# InkAge fizetés: hiánylista (2026-11-07)

A fizetés kódja élesen fent van, de **ki van kapcsolva**. A lista azt mutatja, mi kell még ahhoz, hogy valóban lehessen vásárolni, és mi hiányzik még utána.

## A. Ami nélkül nem lehet vásárolni (élesítés)

| # | Teendő | Ki csinálja |
|---|---|---|
| 1 | **Stripe webhook-cím** az InkAge-nek: `https://inkage.app/api/stripe-webhook`, 7 eseménnyel (lista: `fizetes-elesites-2026-11-07.md`) | Én a Chrome-odban, a te engedélyeddel. A kulcsát (`whsec_…`) te másolod ki. |
| 2 | **Kulcsok a Vercel InkAge-projektjébe** (Production): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `BILLINGO_API_KEY`, `BILLINGO_BLOCK_ID=346955`, `BILLINGO_VAT=AAM`, `ADMIN_NOTIFY_EMAIL`, `NEXT_PUBLIC_PAYMENTS=stripe` | Te (titkos kulcsok, én nem látom és nem írom be őket) |
| 3 | **Újratelepítés** (Redeploy) a kulcsok után | Te vagy én |
| 4 | **Számla-újrapróbáló cron** bekapcsolása | Én (egy SQL-sor) |
| 5 | **Adatbázis-kapcsoló** (`pay.live = true`, a kezdés időpontjával) | Én, ha szólsz |
| 6 | **Egy valódi próbavásárlás** a saját fiókoddal (Mini, $4.99), utána visszatérítés a Stripe-ban | Te fizetsz, én ellenőrzöm a jóváírást, a lakatokat és a számlát |

## B. Amit még nem teszteltem

- A **teljes vásárlás végig valódi Stripe-pal**: fizetés, a webhook jóváírja az előnézeteket, Billingo-számla, visszatérítés és sztornó. Csak az adatbázis-függvényeket próbáltam ki SQL-ben (a végén mindent visszavontam).
- **Bejelentkezve a próba-folyamat:** az első előnézet után csak az 50 év készül el, a többi év lakattal látszik, a lakatra koppintva jön a csomagoldal, és vásárlás után a galériában pótolhatók a lezárt évek. Helyben csak kijelentkezve tudok tesztelni.
- A **profil új kreditkártyája** valódi számokkal (az is csak bekapcsolt fizetéssel jelenik meg).
- Az **admin Bevétel oldalai** valódi InkAge-vásárlással.

## C. Hiányosságok, amik élesítés után is megmaradnak

1. **Az appokban (iOS / Android) nincs vásárlás.** Ott továbbra is havi 30 előnézet jár. Ha valaki a weben elhasználja a próbát, az appban tovább használhatja. Ezt az áruházi vásárlás (Apple / Google) oldaná meg, ami külön munka.
2. **A régi felhasználók nem kapnak értesítést** arról, hogy megszűnik a havi 30. A bekapcsolás hónapjának végéig megmarad nekik, utána jön a próba és a csomag. Egy rövid e-mail kiküldhető lenne nekik.
3. **A `public/llms.txt` még a havi 30-at írja** (ezt az AI-asszisztensek olvassák). A bekapcsoláskor át kell írni.
4. **Az `/ingyenes-beta` oldal** bekapcsolt fizetésnél átirányít a „Hogyan működik” oldalra. A sitemapben azonban még benne van, onnan ki kell venni.
5. **Meghívási bónusz:** aki barátot hív, plusz próbaelőnézetet kap. Több álfiókkal ez kihasználható. Kicsi a kockázat, mert a próbában csak az 50 éves kép készül el.
6. **Közös Billingo-keret a Calligrával:** havi 50 számla. 40 eladás körül váltani kell a Standard csomagra.
7. **A Calligra admin Pénzügy oldala** a Stripe-egyenleget fiókszinten olvassa, ezért az InkAge bevétele is ott fog látszani.
8. **A könyvelővel egyeztetendő:**
   - a számla tételmegnevezése („InkAge Mini csomag: 5 digitális tetoválás-előnézet”);
   - az AAM-áfakulcs;
   - az alanyi adómentes éves keret, amelybe a két app bevétele együtt számít.
9. **Az ÁSZF idegen nyelvű változatait** gép fordította. A magyar és az angol szöveg a mérvadó; jogászi átnézés nem volt.
10. **Vásárlási statisztika:** a nézett és a fizetett események rögzítve vannak (`paywall_open`, `plan_pick`, `checkout_start`, `checkout_done`), de az admin „Heti tölcsér” oldalán még nincsenek külön soraik.

## Ami kész
- Csomagok: Mini 5 / Plus 15 / Studio 40 előnézet ($4.99 / $11.99 / $27.99). Egyszeri vásárlás, összeadódnak, nem járnak le.
- Próba: 1 előnézet, csak az 50 éves (illetve a 10 kezelés utáni) képpel, a többi lakattal. Vásárlás előtt 2 MI-rajz.
- Csomagoldal új dizájnnal. Előnézet: `https://inkage.app/app/explore?csomagok=elonezet`
- Stripe-fizetés, webhook, visszatérítés, fizetési hibák rögzítése, automatikus Billingo-számla.
- E-mail neked minden eladásról (az `ADMIN_NOTIFY_EMAIL` címre).
- Profil: kártya, amely mutatja, hány előnézet maradt és hányat vett csomagban, gombbal a csomagokhoz.
- ÁSZF (eladó, csomagok, elállás), adatvédelem (Stripe, Billingo). A „havi 30” szövegek a bekapcsoláskor maguktól átváltanak.
- A Calligra figyelmen kívül hagyja az InkAge Stripe-eseményeit.
- Mind a 35 nyelv.
