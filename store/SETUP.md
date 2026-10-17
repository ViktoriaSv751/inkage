# InkAge – áruházi appok építése

A natív appok vékony héjak az élő webapp körül (`https://inkage.vercel.app/app`): minden webes javítás azonnal megjelenik bennük, új áruházi verzió csak natív változásnál kell. Csomagnév mindkét platformon: `app.inkage`.

## Egyszer kell beállítani

1. **Supabase → Authentication → URL Configuration → Redirect URLs:** legyen benne `app.inkage://auth` (ezzel tér vissza a Google/Apple-belépés az appba).
2. **Natív push – Android (Firebase):**
   1. console.firebase.google.com → új projekt „InkAge” → Android app hozzáadása, csomagnév `app.inkage`.
   2. A letöltött `google-services.json` ide kerül: `android/app/google-services.json`.
   3. Projektbeállítások → Service accounts → *Generate new private key* → a JSON teljes tartalma a Vercelben: `FCM_SERVICE_ACCOUNT`.
3. **Natív push – iOS (APNs):** developer.apple.com → Keys → új kulcs *Apple Push Notifications service (APNs)* → `.p8` letöltés. Vercel: `APNS_KEY_P8` (a fájl tartalma), `APNS_KEY_ID` (a kulcs azonosítója). TestFlight-teszthez nem kell `APNS_SANDBOX`, Xcode-ból telepített fejlesztői buildhez `APNS_SANDBOX=1`.
4. **Apple App ID (`app.inkage`) képességei:** Push Notifications és Associated Domains bekapcsolva.
5. **Android App Links:** a Play Console → App integrity → App signing oldalról a SHA-256 ujjlenyomat(ok) a Vercelben: `ANDROID_CERT_SHA256` (vesszővel elválasztva).

A Vercel-változók után: Redeploy. Amíg a push-kulcsok nincsenek beállítva, az appban egyszerűen nem jelenik meg az értesítés-kapcsoló, minden más működik.

## Android (Android Studio)

```bash
npm install
npx cap sync android
npx cap open android
```

Android Studio: *Build → Generate Signed App Bundle* → `.aab` → Play Console → *Testing → Closed testing* → feltöltés. A cél-API 36 (Android 16), minimum Android 7 (API 24).

## iOS (Xcode 26)

```bash
npm install
npx cap sync ios
npx cap open ios
```

Xcode: *Signing & Capabilities* → Team: BVM9R6J6D3 (automatikus aláírás), Bundle ID `app.inkage`. *Product → Archive* → *Distribute App → App Store Connect* → TestFlight → beküldés bírálatra. Csak iPhone (iPad kikapcsolva), csak álló tájolás.

## Verziószám emelése

- Android: `android/app/build.gradle` → `versionCode` (+1 minden feltöltésnél) és `versionName`.
- iOS: Xcode → General → Version (`MARKETING_VERSION`) és Build (`CURRENT_PROJECT_VERSION`).

## Ikonok és indulóképernyő újragenerálása

A forrásképek a `resources/` mappában vannak (`icon.png` 1024×1024, `splash.png` 2732×2732):

```bash
npx capacitor-assets generate --iconBackgroundColor '#4b2bd6' --splashBackgroundColor '#f3d6c8' --android --ios
```
