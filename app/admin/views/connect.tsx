"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { type Tone } from "../visuals";
import { Logo } from "../wow";
import { MOCK, ago, api, dt, rpc, type D, useRpc, Loading, StateErr } from "../shared";
import { toast, usePhone } from "../phone";

/* ---------- connections: the keys, entered here (a phone works too), kept encrypted in Supabase Vault ---------- */
export type KeyF = { k: string; l: string; ph?: string; area?: boolean; file?: boolean; opt?: boolean; hint?: string; check?: boolean };

export type Plat = { id: string; name: string; tone: Tone; logo: string; what: string; keys: KeyF[]; steps: { t: React.ReactNode; link?: [string, string]; copy?: string }[]; connect?: string; later?: boolean; src?: string; test?: string; note?: React.ReactNode };

/* the sync_log source of each card (its last run and error) */
const SRC: Record<string, string> = { gsc: "gsc", bing: "bing", cse: "cse", apple: "apple", play: "google", ai: "aivis", psi: "cwv", comp: "competitors" };

export function Connect() {
  const sb = useMemo(() => supabaseBrowser(), []);
  const ks = useRpc("admin_key_status", undefined, []);
  /* one light call (not the whole post list): the accounts without tokens, each source's last run, the tests kept */
  const cx = useRpc("admin_connections", undefined, []);
  const [st, setSt] = useState<D | null>(null);
  const loadSt = useCallback(() => { api("/api/admin/status").then((r) => setSt(r.ok ? r.json : null)).catch(() => {}); }, []);
  useEffect(() => { loadSt(); }, [loadSt]);
  const site = typeof location === "undefined" ? "https://inkage.app" : location.origin.includes("localhost") ? "https://inkage.app" : location.origin;
  const set: Record<string, string> = (ks.d as D) || {};
  const accs: D[] = (cx.d as D)?.accounts || [];
  const sync: D = (cx.d as D)?.sync || {}, tests: D = (cx.d as D)?.tests || {};
  const ig = accs.find((a) => a.platform === "instagram"), igViaFb = ig?.scopes === "via_facebook";
  const P0: Plat[] = [
    { id: "tiktok", name: "TikTok", tone: "peach", logo: "tiktok", what: "Követők, minden videó megtekintése, kedvelése, és hogy melyik videó hozott látogatót.", connect: "/api/admin/connect/tiktok",
      keys: [{ k: "TIKTOK_CLIENT_KEY", l: "Client key", ph: "pl. awx1b2c3d4e5f6g7" }, { k: "TIKTOK_CLIENT_SECRET", l: "Client secret", ph: "a titkos kulcs" }],
      note: <>Sandboxban csak a „Target users” közé felvett fiókod adatai jönnek. Ha az app élesre vált (Production), a kulcsok változatlanok, de <b>újra össze kell kapcsolni</b>: nyomd meg az „Újrakapcsolás” gombot.</>,
      steps: [
        { t: <>Nyisd meg a TikTok fejlesztői oldalát, és lépj be a TikTok-fiókoddal.</>, link: ["https://developers.tiktok.com/apps/", "developers.tiktok.com"] },
        { t: <><b>Connect an app</b> → adj neki nevet (pl. „InkAge Irányító”), aztán <b>Add products</b> → <b>Login Kit</b>.</> },
        { t: <>Az engedélyeknél (Scopes) pipáld be: <b>user.info.basic, user.info.profile, user.info.stats, video.list</b>.</> },
        { t: <>A Login Kit → Web résznél a <b>Redirect URI</b> legyen ez:</>, copy: `${site}/api/admin/callback/tiktok` },
        { t: <>Kapcsold <b>Sandbox</b> módra, és a <b>Target users</b> résznél add hozzá a saját TikTok-fiókodat. Így a TikTok jóváhagyása nélkül is működik. Élesre váltás után itt újra össze kell kapcsolni.</> },
        { t: <>Az app oldalán a <b>Credentials</b> résznél kattints a kulcsok melletti <b>szem ikonra</b> (különben csak pöttyöket másolsz). Másold be ide a <b>Client key</b>-t és a <b>Client secret</b>-et, majd nyomd meg a Mentést.</> },
      ] },
    { id: "instagram", name: "Instagram", tone: "lilac", logo: "instagram", what: "Követők, posztok és reelek elérése, kedvelései, és a bio-linkről érkező látogatók.", connect: "/api/admin/connect/instagram",
      keys: [{ k: "INSTAGRAM_APP_ID", l: "Instagram app ID", ph: "pl. 1234567890123456" }, { k: "INSTAGRAM_APP_SECRET", l: "Instagram app secret", ph: "a titkos kulcs" }],
      note: igViaFb ? <>Az Instagram most a <b>Facebook-oldalon keresztül</b> jön: a kapcsolata nem jár le, és a publikálást a Facebook-kártyán kell bekapcsolni.</> : undefined,
      steps: [
        { t: <>Az Instagram-fiók legyen <b>szakmai fiók</b> (üzleti vagy alkotói): Instagram → Beállítások → Fióktípus és eszközök.</> },
        { t: <>Nyisd meg a Meta fejlesztői oldalát, és hozz létre egy appot: <b>Create app</b> → „Instagram API”.</>, link: ["https://developers.facebook.com/apps/", "developers.facebook.com"] },
        { t: <><b>Instagram → API setup with Instagram login → Set up Instagram business login</b>. A Redirect URL legyen ez:</>, copy: `${site}/api/admin/callback/instagram` },
        { t: <><b>App roles → Roles → Instagram Testers</b>: add hozzá a fiókodat, és az Instagram appban fogadd el a meghívást (Beállítások → Alkalmazások és webhelyek → Tesztelői meghívások).</> },
        { t: <>Másold be ide az <b>Instagram app ID</b>-t és az <b>Instagram app secret</b>-et (nem a Facebook app ID-t), majd Mentés.</> },
      ] },
    { id: "facebook", name: "Facebook", tone: "sky", logo: "facebook", what: "A Facebook-oldalad követői és minden posztja: reakciók, hozzászólások, megosztások, elérés, kattintás. Ha az Instagram az oldalhoz van kötve, az is jön vele.", connect: "/api/admin/connect/facebook",
      keys: [{ k: "FACEBOOK_APP_ID", l: "Facebook App ID", ph: "pl. 1234567890123456" }, { k: "FACEBOOK_APP_SECRET", l: "Facebook App secret", ph: "a titkos kulcs" }],
      note: <>Ha több Facebook-oldalt kezelsz, a bekötés az elsőt veszi: a Facebook belépőablakában csak az InkAge oldalát pipáld be.</>,
      steps: [
        { t: <>Kell egy <b>Facebook-oldal</b> (pl. InkAge), amit kezelsz. Ha az Instagram-fiókod az oldalhoz van kötve (az oldal beállításai → <b>Összekapcsolt fiókok</b> → Instagram), az Instagram adatai is ezzel jönnek, külön Instagram-app nélkül.</> },
        { t: <>A Meta fejlesztői oldalán a <b>saját</b> Facebook-fiókoddal: <b>Create app</b> → használati eset: <b>„Manage everything on your Page”</b> (oldal kezelése).</>, link: ["https://developers.facebook.com/apps/", "developers.facebook.com"] },
        { t: <>Az appban <b>Facebook Login for Business → Settings</b>: a <b>Valid OAuth Redirect URIs</b> legyen ez:</>, copy: `${site}/api/admin/callback/facebook` },
        { t: <><b>App settings → Basic</b>: az <b>App ID</b> és az <b>App secret</b> (a <b>Show</b> gombbal megjelenítve) ide, majd Mentés és <b>Összekapcsolás</b>. Fejlesztői módban is működik, mert te vagy az app gazdája. A belépőablakban csak az InkAge oldalát válaszd ki.</> },
      ] },
    { id: "pinterest", name: "Pinterest", tone: "pink", logo: "pinterest", what: "Követők, havi megtekintés, és minden pin megjelenése, mentése és kattintása a weboldalra.", connect: "/api/admin/connect/pinterest",
      keys: [{ k: "PINTEREST_APP_ID", l: "Pinterest App ID", ph: "pl. 1512345" }, { k: "PINTEREST_APP_SECRET", l: "Pinterest App secret key", ph: "a titkos kulcs" }, { k: "PINTEREST_BOARD_ID", l: "Tábla azonosítója (a Tervezőből ide kerülnek a pinek)", ph: "pl. 1234567890123456789", opt: true, hint: "A tábla címe: pinterest.com/<fiók>/<tábla>/ – a táblaazonosítót a tábla „Szerkesztés” oldalán, vagy az első publikálásnál kérjük." }],
      steps: [
        { t: <>A Pinterest-fiók legyen <b>vállalati fiók</b> (ingyenes átváltás: Beállítások → Fiókbeállítások → Fiók átalakítása).</> },
        { t: <>A Pinterest fejlesztői oldalán: <b>Connect app</b>, név: „InkAge Irányító”. Az alap (Trial) hozzáférés a saját fiókodhoz elég.</>, link: ["https://developers.pinterest.com/apps/", "developers.pinterest.com"] },
        { t: <>Az app <b>Redirect URIs</b> részébe ezt add meg:</>, copy: `${site}/api/admin/callback/pinterest` },
        { t: <>Az <b>App ID</b>-t és az <b>App secret key</b>-t (a <b>Show key</b> gombbal) másold ide, majd Mentés és <b>Összekapcsolás</b>. Ha a Tervezőből is pinelnél, add meg a tábla azonosítóját is.</> },
      ] },
    { id: "linkedin", name: "LinkedIn", tone: "lilac", logo: "linkedin", what: "A céges oldal követői és minden posztja: megjelenés, kattintás, reakció, hozzászólás, megosztás.", connect: "/api/admin/connect/linkedin",
      keys: [{ k: "LINKEDIN_CLIENT_ID", l: "LinkedIn Client ID", ph: "pl. 78abcdefgh1234" }, { k: "LINKEDIN_CLIENT_SECRET", l: "LinkedIn Primary Client Secret", ph: "a titkos kulcs" }],
      steps: [
        { t: <>Kell egy <b>LinkedIn céges oldal</b> (Company Page, pl. InkAge), amit adminisztrálsz.</> },
        { t: <>A LinkedIn fejlesztői oldalán: <b>Create app</b>, és kösd az app-ot a céges oldalhoz (az oldal adminja jóváhagyja).</>, link: ["https://www.linkedin.com/developers/apps", "linkedin.com/developers"] },
        { t: <><b>Products</b> fül: kérd a <b>Community Management API</b>-t. A LinkedIn néhány nap alatt bírálja el; addig a kapcsolat létrejön, de posztadat még nem jön.</> },
        { t: <><b>Auth</b> fül → <b>Authorized redirect URLs</b>:</>, copy: `${site}/api/admin/callback/linkedin` },
        { t: <>Ugyanott a <b>Client ID</b> és a <b>Primary Client Secret</b> (a szem ikonnal) ide, majd Mentés és <b>Összekapcsolás</b>.</> },
      ] },
    { id: "youtube", name: "YouTube", tone: "pink", logo: "youtube", what: "Feliratkozók, minden videó és Shorts megtekintése, nézési ideje, kommentjei (válasz innen).", connect: "/api/admin/connect/youtube",
      keys: [{ k: "YOUTUBE_CLIENT_ID", l: "OAuth Client ID", ph: "…apps.googleusercontent.com" }, { k: "YOUTUBE_CLIENT_SECRET", l: "OAuth Client secret", ph: "GOCSPX-…" }, { k: "YOUTUBE_API_KEY", l: "YouTube API-kulcs (versenytársakhoz, említésekhez)", ph: "AIza…", opt: true },
        { k: "YOUTUBE_OAUTH_PUBLISHED", l: "Az OAuth-képernyő közzétéve („In production”)", opt: true, check: true, hint: "Csak akkor kapcsold be, ha a Google Cloudban a Publishing status „In production”. „Testing” állapotban a kapcsolat 7 naponta megszakad, és előtte figyelmeztetünk." }],
      note: st && !st.youtube_published ? <><b>„Testing” állapot: a Google 7 naponta megszakítja a kapcsolatot.</b> Két nappal előtte szólunk (jelzés és push), és egy kattintás az újrakapcsolás. Végleges megoldás: a Google Cloudban <b>OAuth consent screen → Publish app</b> (saját fiókhoz nem kell ellenőrzés), utána kapcsold be lent a „közzétéve” kapcsolót.</> : undefined,
      steps: [
        { t: <>A Google Cloudban az <b>InkAge</b> projektben kapcsold be a <b>YouTube Data API v3</b>-at és a <b>YouTube Analytics API</b>-t.</>, link: ["https://console.cloud.google.com/apis/library/youtube.googleapis.com?project=inkage", "YouTube Data API"] },
        { t: <><b>APIs & Services → OAuth consent screen</b>: External, a <b>Test users</b> közé add hozzá a saját Google-fiókodat (amihez a csatorna tartozik). Ha teheted, nyomd meg a <b>Publish app</b> gombot is: így nem jár le 7 naponta.</>, link: ["https://console.cloud.google.com/apis/credentials/consent?project=inkage", "OAuth consent screen"] },
        { t: <><b>Credentials → Create credentials → OAuth client ID → Web application</b>. Az <b>Authorized redirect URI</b> legyen ez:</>, copy: `${site}/api/admin/callback/youtube` },
        { t: <>A <b>Client ID</b>-t és a <b>Client secret</b>-et másold ide, majd Mentés és <b>Összekapcsolás</b>, és lépj be a csatornád Google-fiókjával.</> },
      ] },
    { id: "gsc", name: "Google Search Console", tone: "sky", logo: "google", src: "gsc", what: "Mit keresnek a Google-ben, melyik cikked hány kattintást kap, és hányadik helyen vagy.",
      keys: [{ k: "GSC_SERVICE_ACCOUNT_JSON", l: "Szolgáltatásfiók kulcsfájlja (.json)", area: true, file: true, ph: "{ \"type\": \"service_account\", … }" }, { k: "GSC_SITE_URL", l: "Tulajdon (csak ha nem domain-tulajdon)", ph: "sc-domain:inkage.app", opt: true }],
      steps: [
        { t: <>Nyisd meg a Google Cloud konzolt a meglévő <b>InkAge</b> projekttel (új projekt nem kell, a fiókodnál a projektek száma már a felső határon van).</>, link: ["https://console.cloud.google.com/home/dashboard?project=inkage", "console.cloud.google.com"] },
        { t: <>Kapcsold be a <b>Google Search Console API</b>-t: a megnyíló oldalon egy kék <b>Enable</b> gomb.</>, link: ["https://console.cloud.google.com/apis/library/searchconsole.googleapis.com?project=inkage", "API bekapcsolása"] },
        { t: <><b>IAM és adminisztráció → Szolgáltatásfiókok → Létrehozás</b>, aztán a fióknál <b>Kulcsok → Kulcs hozzáadása → JSON</b>. Letöltődik egy .json fájl.</>, link: ["https://console.cloud.google.com/iam-admin/serviceaccounts", "Szolgáltatásfiókok"] },
        { t: <>Lent a <b>Fájl kiválasztása</b> gombbal töltsd fel a letöltött fájlt (telefonon a Fájlok közül), majd Mentés.</> },
        { t: <>A Search Console-ban: <b>Beállítások → Felhasználók és engedélyek → Felhasználó hozzáadása</b>, és add meg a szolgáltatásfiók e-mail-címét (mentés után itt megjelenik, másolható). A „Kipróbálom” megmutatja, hozzáfér-e már.</>, link: ["https://search.google.com/search-console/users", "Search Console"] },
      ] },
    { id: "bing", name: "Bing Webmaster Tools", tone: "sky", logo: "bing", src: "bing", what: "A Bing-keresés megjelenései és kattintásai (a ChatGPT keresője és a Copilot is ebből dolgozik), és a ránk mutató linkek. Ingyenes.",
      keys: [{ k: "BING_WMT_KEY", l: "API-kulcs" }],
      steps: [
        { t: <>Lépj be a Bing Webmaster Toolsba a Microsoft- vagy a Google-fiókoddal, és add hozzá a weboldalt: a legegyszerűbb az <b>Import from Google Search Console</b> (egy kattintás, mert a Google már igazolta).</>, link: ["https://www.bing.com/webmasters/", "bing.com/webmasters"] },
        { t: <>Jobb felül a fogaskerék → <b>API Access</b> → <b>API Key</b> → Generate. A kulcsot másold ide, majd Mentés.</> },
      ] },
    { id: "apple", name: "App Store Connect", tone: "mint", logo: "apple", src: "apple", what: "Letöltések naponta és országonként, és minden App Store-értékelés.",
      keys: [{ k: "ASC_ISSUER_ID", l: "Issuer ID" }, { k: "ASC_KEY_ID", l: "Key ID" }, { k: "ASC_PRIVATE_KEY", l: "A .p8 kulcsfájl", area: true, file: true }, { k: "ASC_APP_ID", l: "Az app Apple ID-ja", ph: "pl. 6744000001" }, { k: "ASC_VENDOR_NUMBER", l: "Vendor number (letöltésekhez)", opt: true, ph: "pl. 89123456" }],
      steps: [
        { t: <>App Store Connect → <b>Users and Access → Integrations → App Store Connect API</b> → <b>Team Keys</b> → „+”: név „InkAge Irányító”, szerep: <b>App Manager</b> (a letöltési jelentésekhez <b>Sales</b> vagy <b>Finance</b> is kell).</>, link: ["https://appstoreconnect.apple.com/access/integrations/api", "App Store Connect"] },
        { t: <>Az oldal tetején látszik az <b>Issuer ID</b>, a kulcs sorában a <b>Key ID</b>. A <b>Download API Key</b> gombbal a .p8 fájlt <b>csak egyszer</b> töltheted le: töltsd fel ide a Fájl kiválasztása gombbal.</> },
        { t: <>Az app Apple ID-ja: <b>Apps → InkAge → App Information → Apple ID</b> (csak számok).</> },
        { t: <>A <b>Vendor number</b>: <b>Payments and Financial Reports</b> (vagy Sales and Trends) oldal bal felső sarka, a fióknév alatt (8 számjegy). Enélkül nincsenek napi letöltésszámok.</>, link: ["https://appstoreconnect.apple.com/itc/payments_and_financial_reports", "Pénzügyi jelentések"] },
      ] },
    { id: "play", name: "Google Play", tone: "butter", logo: "play", src: "google", what: "Telepítések és minden Google Play-értékelés.",
      keys: [{ k: "PLAY_SERVICE_ACCOUNT_JSON", l: "Szolgáltatásfiók kulcsfájlja (.json)", area: true, file: true }, { k: "PLAY_PACKAGE", l: "Csomagnév", ph: "app.inkage", opt: true }, { k: "PLAY_REPORTS_BUCKET", l: "Jelentések tárhelye (pubsite_prod_…)", opt: true, ph: "pubsite_prod_rev_0123456789" }],
      steps: [
        { t: <>A Google Cloud <b>InkAge</b> projektben kapcsold be a <b>Google Play Android Developer API</b>-t, és hozz létre egy szolgáltatásfiókot JSON-kulccsal (lásd a Search Console lépéseit; ugyanaz a fiók is jó).</>, link: ["https://console.cloud.google.com/apis/library/androidpublisher.googleapis.com?project=inkage", "Play Developer API"] },
        { t: <>Play Console → <b>Users and permissions → Invite new users</b>: a szolgáltatásfiók e-mail-címe, jogok: <b>View app information</b>, <b>View financial data</b> (a telepítési jelentésekhez), <b>Reply to reviews</b>.</>, link: ["https://play.google.com/console/", "Play Console"] },
        { t: <>A telepítési jelentések tárhelye: Play Console → <b>Download reports → Statistics</b> → <b>Copy Cloud Storage URI</b>; a <b>pubsite_prod_…</b> részt másold ide. A jog érvénybe lépése akár 24 óra.</> },
        { t: <>Töltsd fel a kulcsfájlt, add meg a csomagnevet (ha nem app.inkage), majd Mentés és Kipróbálom.</> },
      ] },
    { id: "resend", name: "E-mail (Resend)", tone: "mint", logo: "email", test: "resend", what: "A reggeli összefoglaló és a riasztások e-mailje, és a levelek kézbesítése, visszapattanása, spam-jelölése a Monitoring oldalon.",
      keys: [{ k: "RESEND_API_KEY", l: "Resend API-kulcs (enélkül nem megy ki a reggeli e-mail)", ph: "re_…" }, { k: "RESEND_FROM", l: "Feladó", ph: "InkAge <hello@inkage.app>", opt: true }, { k: "RESEND_WEBHOOK_SECRET", l: "Webhook signing secret", ph: "whsec_…", opt: true }],
      steps: [
        { t: <>A Resendben: <b>API Keys → Create API key</b> (Sending access elég), és a kulcsot másold ide. A feladó domainje (inkage.app) legyen igazolva a <b>Domains</b> oldalon.</>, link: ["https://resend.com/api-keys", "resend.com/api-keys"] },
        { t: <><b>Webhooks → Add webhook</b>. Az Endpoint URL legyen ez, és pipáld be az összes <b>email.*</b> eseményt:</>, link: ["https://resend.com/webhooks", "resend.com/webhooks"], copy: `${site}/api/resend-webhook` },
        { t: <>A webhook oldalán a <b>Signing secret</b> (whsec_…) ide, majd Mentés és Kipróbálom.</> },
      ] },
    { id: "ai", name: "MI-elemzés és Telegram", tone: "pink", logo: "ai", src: "aivis", what: "A „Mit mondanak a számok?” elemzés, az MI-láthatóság (ChatGPT, Perplexity is), és ha kéred, a reggeli összefoglaló és a riasztások Telegramon.",
      keys: [{ k: "ANTHROPIC_API_KEY", l: "Anthropic API-kulcs", ph: "sk-ant-…" }, { k: "TELEGRAM_BOT_TOKEN", l: "Telegram-bot token", opt: true }, { k: "TELEGRAM_CHAT_ID", l: "Telegram chat ID", opt: true },
        { k: "OPENAI_API_KEY", l: "OpenAI API-kulcs (a ChatGPT is bekerül az MI-láthatóságba)", opt: true }, { k: "PERPLEXITY_API_KEY", l: "Perplexity API-kulcs", opt: true },
        { k: "ADMIN_AI_MODEL", l: "Modell az elemzésekhez", opt: true, ph: "claude-opus-5-5" }, { k: "ADMIN_AIVIS_MODEL", l: "Claude-modell az MI-láthatósághoz", opt: true, ph: "claude-haiku-5-5" },
        { k: "OPENAI_MODEL", l: "OpenAI-modell", opt: true, ph: "gpt-5-mini" }, { k: "PERPLEXITY_MODEL", l: "Perplexity-modell", opt: true, ph: "sonar" }],
      steps: [
        { t: <>Az API-kulcsot a Claude Console-ban hozhatod létre.</>, link: ["https://console.anthropic.com/settings/keys", "console.anthropic.com"] },
        { t: <>Telegram: írj a <b>@BotFather</b>-nek „/newbot”, a kapott tokent ide. Utána írj egy üzenetet a botodnak, és a chat ID-t a <b>@userinfobot</b> mutatja meg.</> },
        { t: <>A modellek nem kötelezők: üresen az alapértelmezettet használjuk.</> },
      ] },
    { id: "cse", name: "Google Programmable Search", tone: "butter", logo: "google", src: "cse", later: true, what: "A követett keresésekre a helyezésünk ott is, ahol a Search Console még nem mutat adatot. Napi 100 keresés ingyenes.",
      keys: [{ k: "GOOGLE_CSE_KEY", l: "API-kulcs", ph: "AIza…" }, { k: "GOOGLE_CSE_ID", l: "Keresőmotor-azonosító (cx)" }],
      steps: [
        { t: <>Hozz létre egy keresőmotort: „Search the entire web” bekapcsolva. A <b>Search engine ID</b> (cx) ide.</>, link: ["https://programmablesearchengine.google.com/controlpanel/create", "programmablesearchengine.google.com"] },
        { t: <>Az InkAge Google Cloud-projektben: <b>Custom Search API</b> bekapcsolása, majd Credentials → API key. A kulcsot ide.</>, link: ["https://console.cloud.google.com/apis/library/customsearch.googleapis.com?project=inkage", "Custom Search API"] },
      ] },
    { id: "psi", name: "PageSpeed (oldalsebesség)", tone: "sky", logo: "google", src: "cwv", later: true, what: "A főbb oldalak mobil sebessége naponta (Core Web Vitals). Kulcs nélkül is fut, kulccsal nagyobb a napi keret.",
      keys: [{ k: "PSI_API_KEY", l: "PageSpeed Insights API-kulcs", ph: "AIza…", opt: true }],
      steps: [{ t: <>Az InkAge Google Cloud-projektben kapcsold be a <b>PageSpeed Insights API</b>-t, és a Credentials → API key kulcsot másold ide.</>, link: ["https://console.cloud.google.com/apis/library/pagespeedonline.googleapis.com?project=inkage", "PageSpeed Insights API"] }] },
    { id: "comp", name: "Áruházi versenytársak", tone: "peach", logo: "apple", src: "competitors", later: true, what: "A versenytárs appok értékelése és verziója naponta, az App Store nyilvános adataiból. Kulcs nem kell.",
      keys: [{ k: "COMPETITOR_COUNTRY", l: "Ország (kétbetűs kód)", ph: "hu", opt: true }],
      steps: [{ t: <>Melyik ország App Store-ját nézzük (pl. <b>hu</b>, <b>us</b>, <b>de</b>). Üresen: hu.</> }] },
    { id: "vercel", name: "Vercel (build-állapot)", tone: "lilac", logo: "vercel", test: "vercel", later: true, what: "A Monitoring oldalon a legutóbbi telepítések állapota: kész, épül, hibás.",
      keys: [{ k: "VERCEL_API_TOKEN", l: "Vercel API-token (csak olvasás is elég)" }, { k: "VERCEL_PROJECT", l: "Projekt neve", ph: "signa", opt: true }],
      steps: [{ t: <>Vercel → <b>Account Settings → Tokens → Create</b>, hatókör: az InkAge csapata, lejárat: 1 év. A tokent ide.</>, link: ["https://vercel.com/account/settings/tokens", "vercel.com/account/settings/tokens"] }] },
  ];
  /* a key is "there" when Vercel or the Kapcsolatok page has it (the status route says, never the value) */
  const has = (k: string) => !!(set[k] || st?.keys?.[k]);
  const ok = (p: Plat) => p.keys.filter((k) => !k.opt).every((k) => has(k.k)) && (p.keys.some((k) => !k.opt) || p.keys.some((k) => has(k.k)) || ["psi", "comp"].includes(p.id));
  /* the state of each card: connected and working, broken, expiring, keys only, missing */
  const stateOf = (p: Plat) => {
    const acc = accs.find((a) => a.platform === p.id), s = p.src ? sync[p.src] : null, t = tests[p.test || p.id];
    const exp = acc ? expiry(acc, p.id) : null;
    if (acc?.last_error || (s && s.last_ok === false)) return "bad";
    if (exp && exp.getTime() - Date.now() < 7 * 864e5) return "soon";
    if (acc || (s && s.last_ok)) return "ok";
    if (t && t.ok === false) return "bad";
    return ok(p) ? (p.connect ? "keys" : t?.ok ? "ok" : "keys") : p.later ? "later" : "missing";
  };
  const states = P0.map((p) => ({ p, s: stateOf(p) }));
  const nOk = states.filter((x) => x.s === "ok").length, nBad = states.filter((x) => x.s === "bad"), nSoon = states.filter((x) => x.s === "soon");
  const [focus, setFocus] = useState<string | null>(null);
  const main = P0.filter((p) => !p.later);
  const done = main.filter((p) => ["ok", "soon"].includes(stateOf(p))).length;
  if (ks.e && !ks.d) return <div className="g"><div className="s12"><StateErr msg={ks.e} retry={ks.load} /></div></div>;
  if (!ks.d || (!cx.d && !cx.e)) return <Loading />;
  /* one card open at a time: the first platform still to connect */
  const firstOpen = main.find((p) => ["missing", "keys"].includes(stateOf(p)))?.id;
  const fix = () => { const x = nBad[0] || nSoon[0]; if (!x) return; setFocus(x.p.id); setTimeout(() => document.getElementById("conn-" + x.p.id)?.scrollIntoView({ behavior: "smooth", block: "start" }), 50); };
  const reload = () => { ks.load(); cx.load(); loadSt(); };
  return (
    <div className="g">
      <section className="hello s12">
        <div>
          <span className="eyebrow">Kapcsolatok</span>
          <h1>Kösd be a fiókjaidat</h1>
          <p>Minden lépés telefonról is megy. A kulcsokat titkosítva tároljuk (Supabase Vault); ide soha nem írjuk ki őket, és senki más nem látja. <b>{done} / {main.length}</b> fő kapcsolat működik.</p>
        </div>
      </section>
      <div className="s12 conn-prog"><i style={{ width: `${(done / Math.max(1, main.length)) * 100}%` }} /></div>
      <div className="s12 conn-sum">
        <span className="chip good">{nOk} működik</span>
        {nBad.length > 0 && <span className="chip bad">{nBad.length} hibás: {nBad.map((x) => x.p.name).join(", ")}</span>}
        {nSoon.length > 0 && <span className="chip warn">{nSoon.length} hamarosan lejár: {nSoon.map((x) => x.p.name).join(", ")}</span>}
        {(nBad.length > 0 || nSoon.length > 0) && <button className="adm-ibtn sm gold" onClick={fix}>Javítás →</button>}
        <SyncNow done={reload} />
      </div>
      {cx.e && <div className="s12"><StateErr msg={cx.e} retry={cx.load} small /></div>}
      {P0.map((p) => <PlatformCard key={p.id} p={p} first={p.id === firstOpen} focus={focus === p.id} set={set} st={st} ok={ok(p)} state={stateOf(p)} acc={accs.find((a) => a.platform === p.id)} sync={p.src ? sync[p.src] : null} test={tests[p.test || p.id]} igViaFb={igViaFb}
        save={async (k, v) => { const r = await rpc(sb, "admin_key_set", { p_name: k, p_value: v }); reload(); return r.error?.message || ""; }} reload={reload} />)}
      <FreeWatchers sync={sync} />
      <AndroidData />
      <Approvals accs={accs} />
    </div>
  );
}

/* when the connection ends: the refresh token's end, or the access token's where nothing renews it (LinkedIn, Instagram) */
function expiry(acc: D, id: string): Date | null {
  return [acc.refresh_expires_at, (id === "linkedin" || (id === "instagram" && acc.scopes !== "via_facebook")) ? acc.token_expires_at : null].filter(Boolean).map((t: string) => new Date(t)).sort((a, b) => a.getTime() - b.getTime())[0] || null;
}

/* "Lehúzás most": every platform, Google and the stores, recorded as a manual run */
function SyncNow({ done }: { done: () => void }) {
  const [busy, setBusy] = useState(false);
  const run = async () => { setBusy(true); const r = await api("/api/admin/sync", { method: "POST" }); setBusy(false); toast(r.ok && r.json?.ok !== false ? "Lehúzás kész" : "A lehúzás hibával futott: részletek a kártyákon és a Monitoringban"); done(); };
  return <button className="adm-ibtn sm" onClick={run} disabled={busy}>{busy ? "Lehúzás… (akár 1–2 perc)" : "Adatok lehúzása most"}</button>;
}

const SL: Record<string, [string, string]> = { ok: ["✓ működik", "good"], bad: ["hiba", "bad"], soon: ["hamarosan lejár", "warn"], keys: ["kulcsok megvannak", "gold"], later: ["nem kötelező", ""], missing: ["hiányzik", "warn"] };
export function PlatformCard({ p, set, st, ok, state, acc, sync, test: saved, save, reload, first, focus, igViaFb }: { p: Plat; set: Record<string, string>; st: D | null; ok: boolean; state: string; acc?: D; sync?: D | null; test?: D; save: (k: string, v: string) => Promise<string>; reload: () => void; first?: boolean; focus?: boolean; igViaFb?: boolean }) {
  const sb = useMemo(() => supabaseBrowser(), []);
  /* only what still needs connecting stays open; a connected platform shows as one closed line */
  const doneNow = state === "ok";
  const [open, setOpen] = useState(false);
  const [touched, setTouched] = useState(false);
  useEffect(() => { if (!touched) setOpen(!!first && !doneNow); }, [doneNow, touched, first]);
  useEffect(() => { if (focus) { setOpen(true); setTouched(true); } }, [focus]);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [busy, setBusy] = useState(false); const [copied, setCopied] = useState("");
  const copy = (t: string) => navigator.clipboard?.writeText(t).then(() => { setCopied(t); setTimeout(() => setCopied(""), 1600); });
  const email = (() => { try { return JSON.parse(vals.GSC_SERVICE_ACCOUNT_JSON || vals.PLAY_SERVICE_ACCOUNT_JSON || "").client_email as string; } catch { return ""; } })();
  const onFile = (k: string) => async (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (!f) return; if (f.size > 20000) { setMsg({ ok: false, t: "Ez a fájl túl nagy, nem kulcsfájl." }); return; } setVals((o) => ({ ...o, [k]: "" })); const t = (await f.text()).trim();
    /* a chosen key file is saved at once: no second step to forget */
    if (/JSON$/.test(k)) { try { const j = JSON.parse(t); if (!j.client_email || !j.private_key) throw 0; } catch { setMsg({ ok: false, t: "Ez nem egy szolgáltatásfiók kulcsfájlja (.json, benne client_email és private_key)." }); return; } }
    setBusy(true); const err = await save(k, t); setBusy(false);
    if (err) { setMsg({ ok: false, t: err }); return; }
    setVals((o) => ({ ...o, [k]: t })); setMsg({ ok: true, t: "A kulcsfájl elmentve. Most nyomd meg a Kipróbálom gombot." }); };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setMsg(null);
    const todo = Object.entries(vals).filter(([, v]) => v.trim());
    if (!todo.length) { setMsg({ ok: false, t: "Előbb másold be legalább az egyik kulcsot." }); return; }
    for (const [k, v] of todo) {
      if (/JSON$/.test(k)) { try { const j = JSON.parse(v); if (!j.client_email || !j.private_key) throw 0; } catch { setMsg({ ok: false, t: "Ez nem egy szolgáltatásfiók kulcsfájlja (.json, benne client_email és private_key)." }); return; } }
      /* the developer pages hide a key behind dots until the eye icon is pressed: copying then copies only the dots */
      if (/^[\s•●·*∙]+$/.test(v) || /[•●∙]{4}/.test(v)) { setMsg({ ok: false, t: "Ez csak a rejtett, pöttyös változat, nem maga a kulcs. Az app oldalán kattints a kulcs melletti szem ikonra, hogy megjelenjen, és azt másold ide." }); return; }
      if ((k === "TIKTOK_CLIENT_KEY" || k === "TIKTOK_CLIENT_SECRET") && !/^[A-Za-z0-9_-]{10,80}$/.test(v.trim())) { setMsg({ ok: false, t: "A TikTok-kulcs csak betűkből és számokból áll, szóköz nélkül. Másold ki újra az app oldaláról (a szem ikonnal megjelenítve)." }); return; }
      if ((k === "INSTAGRAM_APP_ID" || k === "FACEBOOK_APP_ID" || k === "PINTEREST_APP_ID" || k === "PINTEREST_BOARD_ID" || k === "ASC_APP_ID" || k === "ASC_VENDOR_NUMBER") && !/^\d{4,25}$/.test(v.trim())) { setMsg({ ok: false, t: "Ez a mező csak számjegyekből áll (pl. 1234567890123456)." }); return; }
      if (k === "ASC_PRIVATE_KEY" && !/BEGIN PRIVATE KEY/.test(v)) { setMsg({ ok: false, t: "A .p8 fájl tartalma „-----BEGIN PRIVATE KEY-----” sorral kezdődik." }); return; }
      if (k === "RESEND_API_KEY" && !/^re_/.test(v.trim())) { setMsg({ ok: false, t: "A Resend API-kulcs „re_”-vel kezdődik." }); return; }
      if (k === "RESEND_WEBHOOK_SECRET" && !/^whsec_/.test(v.trim())) { setMsg({ ok: false, t: "A webhook signing secret „whsec_”-kel kezdődik." }); return; }
      if (k === "RESEND_FROM" && !/@[a-z0-9.-]+\.[a-z]{2,}/i.test(v)) { setMsg({ ok: false, t: "A feladó egy e-mail-cím legyen, pl. InkAge <hello@inkage.app>." }); return; }
      if (k === "COMPETITOR_COUNTRY" && !/^[a-z]{2}$/i.test(v.trim())) { setMsg({ ok: false, t: "Kétbetűs országkód kell, pl. hu vagy us." }); return; }
      if (k === "PLAY_PACKAGE" && !/^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/i.test(v.trim())) { setMsg({ ok: false, t: "A csomagnév pontokkal tagolt, pl. app.inkage." }); return; }
    }
    setBusy(true);
    try {
      for (const [k, v] of todo) { const err = await save(k, k === "COMPETITOR_COUNTRY" ? v.trim().toLowerCase() : v.trim()); if (err) { setMsg({ ok: false, t: err }); return; } }
      setVals({}); setMsg({ ok: true, t: p.connect ? "Elmentve. Most nyomd meg az Összekapcsolás gombot, és lépj be a fiókoddal." : "Elmentve. Nyomd meg a Kipróbálom gombot; az adatok a következő lehúzással (vagy fent az „Adatok lehúzása most” gombbal) jönnek." });
    } finally { setBusy(false); }
  };
  const [test, setTest] = useState<{ ok: boolean; msg: string; at?: string } | "busy" | null>(null);
  const shownTest = test && test !== "busy" ? test : saved ? { ok: !!saved.ok, msg: String(saved.msg || ""), at: saved.at } : null;
  /* on a phone the steps come one at a time, with Tovább / Vissza */
  const phone = usePhone(); const [step, setStep] = useState(0);
  const exp = acc ? expiry(acc, p.id) : null;
  const soon = exp && exp.getTime() - Date.now() < 14 * 864e5;
  /* write permission: only what the platform really granted counts (Instagram through Facebook publishes through Facebook) */
  const pub = acc && /instagram_business_content_publish|instagram_content_publish|pages_manage_posts|pins:write|w_organization_social|youtube\.upload|video\.publish/.test(String(acc.scopes || ""));
  const pubHref = p.id === "instagram" && igViaFb ? "/api/admin/connect/facebook?publish=1" : p.connect + "?publish=1";
  const tryIt = async () => { setTest("busy"); const r = await api(`/api/admin/test/${p.test || p.id}`, { method: "POST" }); setTest(r.ok ? r.json as { ok: boolean; msg: string; at?: string } : { ok: false, msg: "A próba nem futott le. Frissítsd az oldalt, és próbáld újra." }); reload(); };
  const srcOf = (k: string) => st?.src?.[k] as string | undefined;
  const clear = async (k: string) => {
    const s = srcOf(k);
    const q = s === "both" ? "Törlöd az itt megadott kulcsot? A Vercelben is megvan ugyanilyen nevű: utána az marad érvényben." : "Törlöd ezt a kulcsot? A kapcsolat leáll, amíg újat nem adsz meg.";
    if (!confirm(q)) return; await save(k, "");
  };
  const disconnect = async () => {
    if (!confirm(`Leválasztod: ${p.name}? A tokenek törlődnek, a lehúzás leáll; a már lehúzott posztok és számok megmaradnak.${p.id === "facebook" && igViaFb ? " Az Instagram is a Facebookon át jön: az is leáll." : ""}`)) return;
    const r = await rpc(sb, "admin_disconnect", { p_platform: p.id });
    if (r.error) { setMsg({ ok: false, t: r.error.message }); return; }
    if (p.id === "facebook" && igViaFb) await rpc(sb, "admin_disconnect", { p_platform: "instagram" });
    toast(p.name + " leválasztva"); reload();
  };
  const lastRun = sync ? (sync.last_ok === false ? <span className="down">utolsó lehúzás hibás ({ago(sync.err_at)}): {String(sync.err || "").slice(0, 160)}</span> : sync.ok_at ? <>utolsó sikeres lehúzás {ago(sync.ok_at)}</> : null) : null;
  return (
    <section className={`c s12 conn t-${p.tone}`} id={"conn-" + p.id}>
      <button className="conn-h" onClick={() => { setTouched(true); setOpen(!open); }} aria-expanded={open}>
        <span className={"conn-logo l-" + p.logo}>{p.name[0]}</span>
        <span className="conn-t"><b>{p.name}</b><small>{p.what}</small>{(acc || sync) && <small className="conn-last">{acc ? (acc.last_error ? <span className="down">hiba: {String(acc.last_error).slice(0, 90)}</span> : <>utolsó lehúzás {ago(acc.last_sync_at)}</>) : lastRun}</small>}</span>
        {soon && <span className="chip warn">lejár: {exp!.toLocaleDateString("hu-HU", { month: "short", day: "numeric" })}</span>}
        <span className={"chip " + (acc && state === "ok" ? "good" : SL[state][1])}>{acc && state === "ok" ? "✓ összekapcsolva" : acc && state === "keys" ? "összekapcsolva" : SL[state][0]}</span>
        <span className="conn-x">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="conn-b">
          {acc && <div className="conn-acc">Bekötve: <b>{acc.username ? "@" + acc.username : acc.display_name || "fiók"}</b>{acc.connected_at ? <> ({dt(acc.connected_at)})</> : null} · utolsó lehúzás {ago(acc.last_sync_at)} · {Number(acc.posts) || 0} poszt nálunk
            {exp ? <> · a kapcsolat {soon ? <b style={{ color: "var(--a-warn)" }}>hamarosan lejár ({exp.toLocaleDateString("hu-HU", { month: "long", day: "numeric" })})</b> : <>érvényes: {exp.toLocaleDateString("hu-HU", { month: "long", day: "numeric" })}</>}</> : p.id === "instagram" && igViaFb ? <> · nem jár le (a Facebook-oldal tokenje)</> : null}
            {acc.last_error ? <div className="alert err" style={{ marginTop: 8 }}>{String(acc.last_error).slice(0, 300)}</div> : null}
            {p.id === "linkedin" && !acc.last_error && !Number(acc.posts) && <div className="alert" style={{ marginTop: 8 }}>A kapcsolat él, de posztadat még nem jön: a LinkedIn a <b>Community Management API</b> jóváhagyásáig nem ad posztstatisztikát (lent a Jóváhagyások blokkban a kérelem szövege).</div>}
          </div>}
          {!acc && lastRun && <div className="conn-acc">{lastRun}</div>}
          {p.note && <div className="alert" style={{ margin: "0 0 10px" }}>{p.note}</div>}
          {phone && p.steps.length > 1 && <div className="wiz-h"><span>{step + 1}. lépés / {p.steps.length}</span><i style={{ width: `${((step + 1) / p.steps.length) * 100}%` }} /></div>}
          <ol className="conn-steps">
            {p.steps.map((x, i) => phone && i !== step ? null : (
              <li key={i}><span className="cs-n">{i + 1}</span><div>
                <p>{x.t}</p>
                {x.link && <a className="adm-ibtn sm" href={x.link[0]} target="_blank" rel="noreferrer">{x.link[1]} ↗</a>}
                {x.copy && <button type="button" className="conn-copy" onClick={() => copy(x.copy!)}><code>{x.copy}</code><span>{copied === x.copy ? "Másolva ✓" : "Másolás"}</span></button>}
              </div></li>
            ))}
          </ol>
          {phone && p.steps.length > 1 && <div className="wiz-nav"><button type="button" className="adm-ibtn" disabled={!step} onClick={() => setStep(step - 1)}>← Vissza</button>{step < p.steps.length - 1 ? <button type="button" className="adm-ibtn gold" onClick={() => setStep(step + 1)}>Tovább →</button> : <span className="note">Utolsó lépés: lent a kulcsok.</span>}</div>}
          <form className="conn-f" onSubmit={submit} autoComplete="off" style={phone && p.steps.length > 1 && step < p.steps.length - 1 ? { display: "none" } : undefined}>
            {p.keys.map((k) => {
              const src = srcOf(k.k), here = !!set[k.k];
              const tag = here || src ? <em className="conn-set">✓ megadva{src === "vercel" ? " a Vercelben" : src === "both" ? " itt és a Vercelben (a Vercel érvényes)" : here ? " " + ago(set[k.k]) : ""}{here && <> · <button type="button" className="lnk" onClick={() => clear(k.k)}>törlés</button></>}</em> : null;
              if (k.check) return (
                <label key={k.k} className="lf lf-check"><span>{k.l}{tag}</span>
                  <button type="button" className={"sw" + (st?.youtube_published ? " on" : "")} role="switch" aria-checked={!!st?.youtube_published} onClick={async () => { const err = await save(k.k, st?.youtube_published ? "" : "1"); setMsg(err ? { ok: false, t: err } : { ok: true, t: st?.youtube_published ? "Kikapcsolva: 7 napos figyelés." : "Bekapcsolva: nem figyelmeztetünk a 7 napos lejáratra." }); }}><i /></button>
                  {k.hint && <small className="note">{k.hint}</small>}</label>);
              return (
                <label key={k.k} className="lf">
                  <span>{k.l}{k.opt ? " (nem kötelező)" : ""}{tag}</span>
                  {k.area ? <textarea className="adm-in conn-in" rows={4} placeholder={here || src ? "Új érték, ha cserélnéd" : k.ph} value={vals[k.k] || ""} onChange={(e) => setVals({ ...vals, [k.k]: e.target.value })} spellCheck={false} />
                    : <input className="adm-in conn-in" type="text" inputMode="text" autoCapitalize="off" autoCorrect="off" spellCheck={false} placeholder={here || src ? "Új érték, ha cserélnéd" : k.ph} value={vals[k.k] || ""} onChange={(e) => setVals({ ...vals, [k.k]: e.target.value })} />}
                  {k.file && <span className="conn-file"><input type="file" accept=".json,.p8,application/json,text/plain" onChange={onFile(k.k)} /><span>Fájl kiválasztása</span>{vals[k.k] ? <small>betöltve ✓</small> : null}</span>}
                  {k.hint && <small className="note">{k.hint}</small>}
                </label>
              );
            })}
            {email && <button type="button" className="conn-copy" onClick={() => copy(email)}><code>{email}</code><span>{copied === email ? "Másolva ✓" : "E-mail másolása"}</span></button>}
            {msg && <div className={"alert " + (msg.ok ? "ok" : "err")}>{msg.t}</div>}
            <div className="conn-actions">
              <button className="adm-ibtn gold conn-save" disabled={busy}>{busy ? "Mentés…" : "Mentés"}</button>
              {(ok || acc) && <button type="button" className="adm-ibtn conn-save" onClick={tryIt} disabled={test === "busy"}>{test === "busy" ? "Próba…" : "Kipróbálom"}</button>}
              {p.connect && ok && <a className="adm-ibtn conn-save" href={MOCK ? undefined : p.connect}>{acc ? "Újrakapcsolás" : "Összekapcsolás"} →</a>}
              {p.connect && acc && <a className="adm-ibtn conn-save" href={MOCK ? undefined : pubHref} title="Újra belépsz, és az írási engedélyt is megadod: utána a Tervezőből innen lehet posztolni">{pub ? "✓ Publikálás bekapcsolva" : p.id === "instagram" && igViaFb ? "Publikálás (a Facebookon át)" : "Publikálás bekapcsolása"}</a>}
              {acc && <button type="button" className="adm-ibtn conn-save danger" onClick={disconnect}>Leválasztás</button>}
            </div>
            {shownTest && <div className={"alert " + (shownTest.ok ? "ok" : "err")}>{shownTest.msg}{shownTest.at ? <small className="mut"> · próba: {ago(shownTest.at)}</small> : null}</div>}
            <p className="note">A Vercelben megadott azonos nevű kulcs elsőbbséget kap. A kulcsot itt soha nem mutatjuk meg újra; ha elírtad, add meg újra.</p>
          </form>
        </div>
      )}
    </section>
  );
}

/* the free watchers that need no key (or only an optional one): each with its own state */
function FreeWatchers({ sync }: { sync: D }) {
  const W: [string, string, string, string][] = [["cwv", "PageSpeed", "A főbb oldalak mobil sebessége, naponta.", "Kulcs nélkül is fut."], ["watch", "Említések, tanúsítvány, Google-frissítések", "Reddit, Hacker News, Google Hírek, YouTube; a tanúsítvány és a domain lejárata; naponta.", "Kulcs nem kell."],
    ["competitors", "App Store-versenytársak", "A versenytárs appok értékelése, naponta.", "Kulcs nem kell."], ["seo", "SEO-bejárás", "A weboldal minden oldala, hetente.", "Kulcs nem kell."]];
  return (
    <section className="c s12">
      <div className="c-h"><div><div><h2>Ingyenes figyelők</h2></div></div></div>
      <ul className="watchers">{W.map(([k, l, what, key]) => { const s = sync[k];
        return <li key={k}><b>{l}</b><span>{what} <small className="mut">{key}</small></span>{s ? <span className={"chip " + (s.last_ok === false ? "bad" : "good")}>{s.last_ok === false ? "hiba " + ago(s.err_at) : "✓ " + ago(s.ok_at)}</span> : <span className="chip">még nem futott</span>}</li>; })}
        <li><b>Külső elérhetőség-figyelő</b><span>Ha a Supabase leáll, a saját mérés is áll. Egy ingyenes UptimeRobot-figyelő a <code>https://inkage.app/api/health</code> címre e-mailt küld kiesésnél. <small className="mut">Regisztráció kell: ezt neked kell beállítanod.</small></span><a className="adm-ibtn sm" href="https://uptimerobot.com/" target="_blank" rel="noreferrer">uptimerobot.com ↗</a></li>
      </ul>
    </section>
  );
}

/* The extra permissions some numbers need: the request texts, written and ready to paste into each platform's form,
   with their state (not sent / sent / approved), kept in the database */
const REQS: { k: string; name: string; logo: string; what: string; link: [string, string]; text: string }[] = [
  { k: "tt-biz", name: "TikTok Business API", logo: "tiktok", what: "Nézési idő, végignézési arány, mentések, forgalomforrás (Neked oldal, Profil, Keresés), demográfia, kommentek és válasz.",
    link: ["https://business-api.tiktok.com/portal/apply", "business-api.tiktok.com"],
    text: "InkAge (inkage.app) is a tattoo preview app: it shows a tattoo design on a photo of your own skin, and how that tattoo will age over 10, 30 and 50 years. We are requesting access to the TikTok Accounts API for our own TikTok Business account (@inkage.app) only. The data (video insights: views, average watch time, completion rate, traffic source, audience demographics; comments) is shown in our private, owner-only analytics dashboard, so we can see which videos bring people to the app and answer comments in one place. No data about other accounts is collected, nothing is shared or sold, and the dashboard has a single user (the account owner)." },
  { k: "tt-post", name: "TikTok Content Posting (audit)", logo: "tiktok", what: "Videók nyilvános közzététele közvetlenül a Tervezőből.",
    link: ["https://developers.tiktok.com/doc/content-sharing-guidelines", "developers.tiktok.com"],
    text: "We use the Content Posting API (Direct Post) only to publish videos to our own TikTok account (@inkage.app) from our private content planner. The owner reviews every caption and privacy setting before posting; the post is created on her explicit action. No third-party accounts are connected." },
  { k: "meta-msg", name: "Meta: Instagram-üzenetek", logo: "instagram", what: "Az Instagram DM-ek megjelenése a Postafiókban, válasszal.",
    link: ["https://developers.facebook.com/docs/app-review", "App Review"],
    text: "instagram_business_manage_messages: our app is a private dashboard used only by the owner of the InkAge Instagram business account. It lists the direct messages the account receives next to its comments, so the owner can answer them from one inbox. Messages are never shared, analysed by third parties or used for advertising. Screencast: the owner opens the inbox, reads a message and sends a reply." },
  { k: "li-cma", name: "LinkedIn Community Management API", logo: "linkedin", what: "A céges oldal követői és a posztok megjelenése, kattintása, reakciói.",
    link: ["https://www.linkedin.com/developers/apps", "linkedin.com/developers"],
    text: "InkAge (inkage.app, a tattoo preview and tattoo aging app) requests the Community Management API for its own LinkedIn Page only. We read the Page's follower count and the statistics of the Page's own posts (impressions, clicks, reactions, comments, shares) to show them in our private, owner-only analytics dashboard. We do not access member data, do not post on behalf of others, and do not store data beyond these aggregate statistics." },
];
const AST: Record<string, [string, string]> = { none: ["nincs beadva", ""], sent: ["beadva", "warn"], ok: ["jóváhagyva", "good"], no: ["elutasítva", "bad"] };
function Approvals({ accs }: { accs: D[] }) {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [c, setC] = useState("");
  const [st, setSt] = useState<Record<string, { s: string; at?: string }>>({});
  const loaded = useRef(false);
  useEffect(() => { rpc(sb, "admin_setting_get", { p_k: "approvals" }).then(({ data }) => { loaded.current = true; if (data && typeof data === "object") setSt(data as any); }); }, [sb]);
  /* LinkedIn's approval shows itself: posts arrive */
  const li = accs.find((a) => a.platform === "linkedin");
  const auto = (k: string) => (k === "li-cma" && li && Number(li.posts) > 0 ? "ok" : null);
  const setS = (k: string, s: string) => { const x = { ...st, [k]: { s, at: new Date().toISOString() } }; setSt(x); rpc(sb, "admin_setting_save", { p_k: "approvals", p_v: x }).then((r) => toast(r.error ? "Nem sikerült: " + r.error.message : "Mentve")); };
  return (
    <section className="c s12">
      <div className="c-h"><div><div><h2>Jóváhagyások</h2></div></div></div>
      <p className="note" style={{ marginTop: -6 }}>Néhány számhoz a platform külön engedélye kell. A kérelmek szövege kész: másold be a platform űrlapjába, és jelöld itt, hol tart. A bírálat pár nap–pár hét.</p>
      <ul className="appr">{REQS.map((r) => { const s = auto(r.k) || st[r.k]?.s || "none";
        return (
        <li key={r.k}>
          <div className="appr-h"><Logo k={r.logo} size={30} /><div><b>{r.name}</b><small>{r.what}</small></div><span className={"chip " + AST[s][1]}>{AST[s][0]}{st[r.k]?.at && s !== "none" ? " · " + new Date(st[r.k].at!).toLocaleDateString("hu-HU", { month: "short", day: "numeric" }) : ""}</span><a className="adm-ibtn sm" href={r.link[0]} target="_blank" rel="noreferrer">{r.link[1]} ↗</a></div>
          <p className="appr-t">{r.text}</p>
          <div className="adm-row">
            <button className="adm-ibtn sm" onClick={() => { navigator.clipboard?.writeText(r.text); setC(r.k); setTimeout(() => setC(""), 1600); }}>{c === r.k ? "Másolva ✓" : "Szöveg másolása"}</button>
            <div className="adm-seg sm">{(["none", "sent", "ok", "no"] as const).map((k) => <button key={k} aria-pressed={s === k} onClick={() => setS(r.k, k)}>{AST[k][0]}</button>)}</div>
          </div>
        </li>); })}</ul>
    </section>
  );
}

/* ---------- the Android app's extra anonymous data: platform, app version, the sign-up event. Off until the owner has
   added them to the Google Play data-safety form; the web sends them already, the iPhone app sends nothing ---------- */
function AndroidData() {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [on, setOn] = useState<boolean | null>(null); const [busy, setBusy] = useState(false);
  useEffect(() => { if (MOCK) { setOn(false); return; } rpc(sb, "track_flags").then(({ data }) => setOn(!!(data as D | null)?.android_ext)); }, [sb]);
  const flip = async () => {
    if (on === false && !confirm("Csak akkor kapcsold be, ha a Google Play adatbiztonsági űrlapján már szerepel: alkalmazás-interakciók és alkalmazásverzió (névtelenül, analitikához). Bekapcsolod?")) return;
    setBusy(true); const r = MOCK ? { data: { android_ext: !on }, error: null } : await rpc(sb, "admin_track_flag_set", { p_on: !on }); setBusy(false);
    if (r.error) { toast("Nem sikerült: " + r.error.message); return; }
    setOn(!!(r.data as D | null)?.android_ext); toast(!on ? "Bekapcsolva: az Android-app új munkameneteitől" : "Kikapcsolva");
  };
  return (
    <section className="c s12">
      <div className="c-h"><div><div><h2>Android-app: platform és regisztráció mérése</h2><p className="sub">A weboldal már küldi, honnan nézik (web), melyik beépített böngészőből (TikTok, Instagram…), és ha valaki regisztrál. Az Android-app ezt csak bekapcsolás után küldi (platform, appverzió, regisztráció), mert előbb a Google Play adatbiztonsági űrlapjára fel kell venni. Az iPhone-app semmit nem küld.</p></div></div>
        <button className={"adm-ibtn" + (on ? " gold" : "")} disabled={on === null || busy} onClick={flip}>{on === null ? "…" : on ? "✓ Bekapcsolva" : "Kikapcsolva · bekapcsolom"}</button></div>
    </section>
  );
}
