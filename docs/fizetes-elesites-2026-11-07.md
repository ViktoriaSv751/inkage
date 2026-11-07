# InkAge webes fizetés: élesítés (2026-11-07)

## Amit tud
- **Csomagok:** egyszeri vásárlás, minden országban ugyanaz a dollárár (`lib/pricing.ts` és az adatbázis `pay_plan_credits` függvénye; a kettőt mindig együtt kell módosítani).
  - Mini: 5 előnézet, $4.99
  - Plus: 15 előnézet, $11.99 („Legnépszerűbb” címkével)
  - Studio: 40 előnézet, $27.99
- **Csomagoldal** (`app/app/_ui/Packages.tsx`): teljes képernyős, sötét oldal, a Calligráéhoz hasonló. A tetején mozgó képfal van négy valódi InkAge-eredményből (felül „Ma”, alatta ugyanaz „50 év”). Mindig a Mini van előre kiválasztva. Alatta a „Próba és csomag” összehasonlító tábla pipákkal és lakatokkal, az elállási jelölőnégyzet (pipa nélkül pirosan megrázkódik) és egy ragadós fizetés gomb.
- **Kipróbálás:** 1 előnézet. Ebből csak a friss kép és az 50 év múlva kép készül (lézeres módban a 10 kezelés utáni). Az 1, 10 és 30 év (illetve a 3 és 6 kezelés) lakattal látszik, és bármelyik csomag megnyitja. Vásárlás után a galériában a „Hiányzó évek elkészítése” gomb pótolja őket.
- **AI rajz és kivágás:** vásárlás előtt összesen 2 használható, utána a régi napi 15-ös korlát él.
- **Régi fiókok** (a bekapcsolás előtt regisztráltak): a bekapcsolás hónapjának végéig a régi havi 30-at kapják, lakat nélkül. Utána nekik is kipróbálás + csomag jár.
- **Áruházi appok** (iOS / Android): semmi nem változik, maradnak a havi 30-on. Árat és csomagot sehol nem látnak (Apple 3.1.1), amíg nincs áruházi vásárlás. Az app minden hívásban küldi az `x-ink-app` fejlécet; a szerver ezt csak WebView-ból és a db-titokkal együtt fogadja el.
- **Stripe:** Checkout `price_data`-val (Stripe-ban nem kell terméket létrehozni). Az elállási jogról lemondó jelölőnégyzet nélkül nem indul fizetés. A bankszámlakivonaton „INKAGE” utótag szerepel.
- **Számla:** minden eladásról Billingo e-számla és NAV-bejelentés, ugyanabban a számlatömbben, mint a Calligráé. Ha nincs a vevőnek címe, a számla nem megy ki, hanem e-mail jön róla. A sikertelen számlákat a `/api/pay-cron` 10 percenként újrapróbálja.
- **Admin:** a Bevétel oldalak (Fizetések, Vevők, Pénzügy, Fizetési hibák, Árak) innentől valós adatot mutatnak. A „Csomag adása” gomb működik.

## Kész (2026-11-07)
- Adatbázis: az `inkage_payments_01` és `inkage_payments_02` migrációk élesek, de **kikapcsolt** állapotban (`admin_settings` `pay.live = false`). Amíg ki van kapcsolva, mindenki a régi havi 30-at kapja.
- Kód: az InkAge `payments` ágon van. Amíg a `NEXT_PUBLIC_PAYMENTS` nincs beállítva, a feltöltése után sem változik semmi.
- Calligra: a `ignore-inkage-events` ágon (cfa6d77). A Calligra webhookja és az admin-szinkron figyelmen kívül hagyja az InkAge-eladásokat. **Ennek előbb kell élesbe mennie, mint az InkAge fizetésének**, különben a Calligra webhookja hibát jelez az InkAge-vásárlásokra, és a Stripe újrapróbálja őket.

## Élesítés sorrendje
1. A Calligra `ignore-inkage-events` ág feltöltése a mainre (élesbe megy).
2. Az InkAge `payments` ág feltöltése a mainre (még mindig kikapcsolt állapotban).
3. **Stripe Dashboard → Fejlesztők → Webhookok → Új végpont** (ugyanabban a fiókban, mint a Calligra):
   - URL: `https://inkage.app/api/stripe-webhook`
   - Események: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`, `payment_intent.payment_failed`, `charge.refunded`, `charge.dispute.created`, `charge.dispute.closed`
4. **Vercel → inkage projekt → Environment Variables (Production):**
   - `STRIPE_SECRET_KEY`: ugyanaz, mint a Calligráé
   - `STRIPE_WEBHOOK_SECRET`: az új végpont saját kulcsa (`whsec_…`)
   - `BILLINGO_API_KEY`, `BILLINGO_BLOCK_ID=346955`, `BILLINGO_VAT=AAM`: ugyanazok, mint a Calligráé
   - `ADMIN_NOTIFY_EMAIL`: ide jönnek a számlás figyelmeztetések (ha nincs megadva, a `CONTACT_EMAIL`-re mennek)
   - `NEXT_PUBLIC_PAYMENTS=stripe`
   - Utána új telepítés (Redeploy).
5. A számla-újrapróbáló cron bekapcsolása SQL-ben:
   `select cron.schedule('inkage-invoices', '*/10 * * * *', $$select public.admin_cron_call('/api/pay-cron')$$);`
6. **A bekapcsolás** (SQL; a `start` dönti el, ki számít régi fióknak):
   `update admin_settings set v = v || jsonb_build_object('live', true, 'start', now()) where k = 'pay';`
7. Egy valódi Mini vásárlás a saját fiókoddal. Ellenőrizni kell:
   - jóváíródik-e 5 előnézet;
   - megnyílnak-e a lezárt évek;
   - kiment-e a számla a Billingóban.
   Utána a Stripe-ban visszatérítés. Ekkor el kell tűnnie a 5 előnézetnek, és sztornószámlának kell készülnie.
8. A `public/llms.txt` és a `/ingyenes-beta` oldal szövege még a havi 30-ról szól: ezeket át kell írni (az `ingyenes-beta` oldalt érdemes megszüntetni vagy átirányítani).

## Visszakapcsolás
`update admin_settings set v = v || '{"live": false}' where k = 'pay';` Ettől kezdve azonnal mindenki a régi havi 30-at kapja. A `NEXT_PUBLIC_PAYMENTS` törlése és egy újratelepítés eltünteti a csomagválasztót és az új szövegeket.

## Nyitott
- **Billingo keret:** a Calligrával közös havi 50 dokumentum. 40 eladás körül Standard csomagra kell váltani.
- **Calligra admin Pénzügy oldala:** a Stripe egyenlegmozgásokat (`balance_transactions`) fiók szinten olvassa, így az InkAge bevétele is megjelenik benne.
- **A könyvelővel egyeztetendő:** a számla tételmegnevezése és az áfakulcs (AAM) InkAge-nél is jó-e, és az alanyi adómentes éves keretbe mindkét app bevétele beleszámít.
- **Nem tesztelt:** a lezárt évek nézete bejelentkezett fiókkal, és a webhook valódi Stripe-hívással. Helyben csak a csomagválasztó ablak, a jelölőnégyzet és a „nem elérhető” válasz lett megnézve. Az adatbázis-függvényeket SQL-ben, visszagörgetett tranzakcióban teszteltem (kipróbálás, lakatok, vásárlás jóváírása, ismételt webhook).
