'use client';
import { useEffect, useState } from 'react';
import { fromBrowser, hasDict, isLang, Lang, registerDict, tr, tx } from './tr';

export type { Lang } from './tr';
export { tx, tr, pick, qOf, ampOf, localeOf, langOf, LANGS, LANG_INFO, isLang } from './tr';

/** The dictionary for a language other than Hungarian / English, loaded only when that language is used. */
const LOADERS: Partial<Record<Lang, () => Promise<any>>> = {
  de: () => import('./locales/de.json'),
  es: () => import('./locales/es.json'),
  pt: () => import('./locales/pt.json'),
  fr: () => import('./locales/fr.json'),
  it: () => import('./locales/it.json'),
  pl: () => import('./locales/pl.json'),
  tr: () => import('./locales/tr.json'),
  ro: () => import('./locales/ro.json'),
  nl: () => import('./locales/nl.json'),
  sv: () => import('./locales/sv.json'),
  cs: () => import('./locales/cs.json'),
  el: () => import('./locales/el.json'),
  uk: () => import('./locales/uk.json'),
  ja: () => import('./locales/ja.json'),
  ko: () => import('./locales/ko.json'),
  id: () => import('./locales/id.json'),
  th: () => import('./locales/th.json'),
  zh: () => import('./locales/zh.json'),
  vi: () => import('./locales/vi.json'),
  fil: () => import('./locales/fil.json'),
  ms: () => import('./locales/ms.json'),
  zhs: () => import('./locales/zhs.json'),
  da: () => import('./locales/da.json'),
  'no': () => import('./locales/no.json'),
  fi: () => import('./locales/fi.json'),
  sk: () => import('./locales/sk.json'),
  hr: () => import('./locales/hr.json'),
  bg: () => import('./locales/bg.json'),
  sl: () => import('./locales/sl.json'),
  lt: () => import('./locales/lt.json'),
  lv: () => import('./locales/lv.json'),
  et: () => import('./locales/et.json'),
  sr: () => import('./locales/sr.json'),
};
export async function loadDict(l: Lang) {
  if (hasDict(l)) return;
  const f = LOADERS[l];
  if (!f) return;
  try {
    const m = await f();
    registerDict(l, (m.default || m) as any);
  } catch {}
}

const EN = {
  'nav.create': 'Create',
  'nav.gallery': 'Gallery',
  'nav.explore': 'Explore',
  'nav.profile': 'Profile',
  'common.continue': 'Continue',
  'common.back': 'Back',
  'common.skip': 'Skip',
  'common.cancel': 'Cancel',
  'common.save': 'Save',
  'common.done': 'Done',
  'common.retry': 'Try again',
  'common.signin': 'Sign in',
  'common.signout': 'Sign out',
  'common.close': 'Close',
  'stage.fresh': 'Fresh',
  'stage.healed': '1 year',
  'stage.y10': '10 years',
  'stage.y30': '30 years',
  'stage.y50': '50 years',
  'create.photo.title': 'Your photo',
  'create.photo.sub': 'Show the spot where the tattoo will go, in daylight, nothing covering it.',
  'create.photo.camera': 'Take a photo',
  'create.photo.library': 'Choose from library',
  'create.photo.checking': 'Checking your photo…',
  'create.photo.ok': 'Looks good',
  'create.design.title': 'The design',
  'create.design.sub': 'A screenshot, a Pinterest pin, a sketch — or pick one from the library.',
  'create.design.upload': 'Upload a design',
  'create.design.paste': 'Paste from clipboard',
  'create.design.library': 'Browse designs',
  'create.place.title': 'Place it',
  'create.place.sub': 'Drag to move. Pinch or use the sliders to resize and rotate.',
  'create.place.size': 'Size',
  'create.place.rotate': 'Rotate',
  'create.place.mirror': 'Mirror',
  'create.place.ink': 'Ink',
  'create.place.black': 'Black',
  'create.place.color': 'Original colors',
  'create.place.where': 'Body area',
  'create.go': 'Show me my tattoo',
  'create.free': '30 previews a month with your account.',
  'gen.s1': 'Reading your skin tone and light',
  'gen.s2': 'Tattooing the design onto your photo',
  'gen.s3': 'Checking the result',
  'gen.s4': 'Aging it 1, 10, 30 and 50 years',
  'result.score': 'Ink longevity score',
  'result.compare': 'Before / after',
  'result.video': 'Make a TikTok video',
  'result.save': 'Save image',
  'result.share': 'Ask friends',
  'result.new': 'New design',
  'result.saved': 'Saved to your gallery',
  'result.notes': 'Notes for your artist',
  'result.tips': 'Keep it looking fresh',
  'gallery.title': 'Your designs',
  'gallery.empty': 'Your previews will appear here. Make your first one — it takes about a minute.',
  'gallery.compare': 'Compare two',
  'gallery.favorites': 'Favorites',
  'gallery.all': 'All',
  'explore.title': 'Explore',
  'profile.title': 'Profile',
  'profile.lang': 'Language',
  'profile.invite': 'Invite a friend',
  'profile.inviteSub': 'You both get an extra preview when they sign up with your link.',
  'profile.copy': 'Copy link',
  'profile.copied': 'Copied',
  'profile.install': 'Add InkAge to your home screen',
  'profile.erase': 'Delete my account and data',
  'profile.eraseConfirm': 'Type DELETE to confirm. This removes your account and every saved preview.',
  'limit.used': 'You reached this month’s limit',
  'limit.sub': 'You get 30 previews a month. They start again on the 1st — or invite a friend: you both get extra previews.',
} as const;

type Key = keyof typeof EN;

const HU: Record<Key, string> = {
  'nav.create': 'Új terv',
  'nav.gallery': 'Galéria',
  'nav.explore': 'Felfedezés',
  'nav.profile': 'Profil',
  'common.continue': 'Tovább',
  'common.back': 'Vissza',
  'common.skip': 'Kihagyom',
  'common.cancel': 'Mégse',
  'common.save': 'Mentés',
  'common.done': 'Kész',
  'common.retry': 'Újra',
  'common.signin': 'Bejelentkezés',
  'common.signout': 'Kijelentkezés',
  'common.close': 'Bezárás',
  'stage.fresh': 'Friss',
  'stage.healed': '1 év',
  'stage.y10': '10 év',
  'stage.y30': '30 év',
  'stage.y50': '50 év',
  'create.photo.title': 'A fotód',
  'create.photo.sub': 'Azt a testrészt mutasd, ahová a tetoválás kerül, nappali fényben, takarás nélkül.',
  'create.photo.camera': 'Fotó készítése',
  'create.photo.library': 'Választás a galériából',
  'create.photo.checking': 'A fotó ellenőrzése…',
  'create.photo.ok': 'Jó lesz',
  'create.design.title': 'A minta',
  'create.design.sub': 'Képernyőfotó, Pinterest-kép, saját rajz – vagy válassz a könyvtárból.',
  'create.design.upload': 'Minta feltöltése',
  'create.design.paste': 'Beillesztés vágólapról',
  'create.design.library': 'Minták böngészése',
  'create.place.title': 'Helyezd el',
  'create.place.sub': 'Húzd a helyére. Két ujjal vagy a csúszkákkal méretezhető és forgatható.',
  'create.place.size': 'Méret',
  'create.place.rotate': 'Forgatás',
  'create.place.mirror': 'Tükrözés',
  'create.place.ink': 'Tinta',
  'create.place.black': 'Fekete',
  'create.place.color': 'Eredeti színek',
  'create.place.where': 'Testrész',
  'create.go': 'Mutasd a tetoválásom',
  'create.free': 'A fiókoddal havonta 30 előnézet jár.',
  'gen.s1': 'Bőrtónus és fények elemzése',
  'gen.s2': 'A minta rátetoválása a fotódra',
  'gen.s3': 'Az eredmény ellenőrzése',
  'gen.s4': 'Öregítés: 1, 10, 30 és 50 év',
  'result.score': 'Tartóssági pontszám',
  'result.compare': 'Előtte / utána',
  'result.video': 'TikTok-videó készítése',
  'result.save': 'Kép mentése',
  'result.share': 'Kérd ki a barátaid véleményét',
  'result.new': 'Új minta',
  'result.saved': 'Elmentve a galériádba',
  'result.notes': 'Jegyzet a tetoválónak',
  'result.tips': 'Így marad szép',
  'gallery.title': 'A terveid',
  'gallery.empty': 'Itt jelennek meg az előnézeteid. Készítsd el az elsőt – kb. egy perc.',
  'gallery.compare': 'Két terv összehasonlítása',
  'gallery.favorites': 'Kedvencek',
  'gallery.all': 'Mind',
  'explore.title': 'Felfedezés',
  'profile.title': 'Profil',
  'profile.lang': 'Nyelv',
  'profile.invite': 'Hívj meg egy barátot',
  'profile.inviteSub': 'Ha a linkeddel regisztrál, mindketten kaptok egy plusz előnézetet.',
  'profile.copy': 'Link másolása',
  'profile.copied': 'Másolva',
  'profile.install': 'InkAge a kezdőképernyőre',
  'profile.erase': 'Fiókom és adataim törlése',
  'profile.eraseConfirm': 'Írd be: TÖRLÉS. Ez törli a fiókodat és minden mentett előnézetet.',
  'limit.used': 'Elérted a havi keretet',
  'limit.sub': 'Havonta 30 előnézet jár. Minden hónap 1-jén újraindul – vagy hívj meg egy barátot, és mindketten kaptok plusz előnézeteket.',
};

const DICTS: Record<'en' | 'hu', Record<Key, string>> = { en: EN as any, hu: HU };

export function detectLang(): Lang {
  try {
    // an explicit ?lang= in the address wins (language links in the footer, shared links) and is remembered
    const q = new URLSearchParams(location.search).get('lang');
    if (isLang(q)) {
      localStorage.setItem('ink_lang', q);
      document.cookie = `ink_lang=${q}; Path=/; Max-Age=31536000; SameSite=Lax`;
      return q;
    }
  } catch {}
  try {
    const saved = localStorage.getItem('ink_lang');
    if (isLang(saved)) return saved;
  } catch {}
  return typeof navigator !== 'undefined' ? fromBrowser(navigator.language) : 'en';
}

let current: Lang = 'en';
const listeners = new Set<(l: Lang) => void>();

/**
 * Switch the language: remembered (device + cookie for the server), then the page reloads in it,
 * so every part – website, app, server-rendered pages – comes back in the new language at once.
 */
export async function setLang(l: Lang) {
  current = l;
  try {
    localStorage.setItem('ink_lang', l);
    document.cookie = `ink_lang=${l}; Path=/; Max-Age=31536000; SameSite=Lax`;
  } catch {}
  try {
    const u = new URL(location.href);
    if (/^\/(app|v|admin|offline)(\/|$)/.test(u.pathname) || l === 'hu') u.searchParams.delete('lang');
    else u.searchParams.set('lang', l);
    location.replace(u.toString());
    if (u.toString() === location.href) location.reload();
  } catch {
    location.reload();
  }
}

export function useLang() {
  const [lang, set] = useState<Lang>(current);
  useEffect(() => {
    const l = detectLang();
    listeners.add(set);
    loadDict(l).then(() => {
      current = l;
      set(l);
      document.documentElement.lang = l;
    });
    return () => {
      listeners.delete(set);
    };
  }, []);
  const t = (k: Key) => (lang === 'hu' ? HU[k] ?? EN[k] : lang === 'en' ? EN[k] : tr(lang, EN[k]));
  return { lang, t, setLang };
}


/** Server messages are English; show them in Hungarian when the app is in Hungarian. */
const ERR_HU: [RegExp, string][] = [
  [/^Pick at least one design/, 'Válassz legalább egy tervet.'],
  [/^Wait for the images first/, 'Várd meg, amíg elkészülnek a képek.'],
  [/^An image is missing or too big/, 'Egy kép hiányzik vagy túl nagy. Próbáld újra.'],
  [/^You shared a lot today/, 'Ma már sokat osztottál meg. Próbáld újra holnap.'],
  [/^Sharing failed/, 'A megosztás nem sikerült. Próbáld újra.'],
  [/^Wait for the 50-year images first/, 'Várd meg, amíg mindkét 50 éves kép elkészül.'],
  [/^That link can’t be opened/, 'Ezt a linket nem tudjuk megnyitni. Másold ki magát a képet, vagy mentsd el és töltsd fel.'],
  [/^We couldn’t find a picture on that page/, 'Ezen az oldalon nem találtunk képet. Másold ki magát a képet, vagy mentsd el és töltsd fel.'],
  [/^That link isn’t a picture/, 'Ez a link nem képre mutat.'],
  [/^That picture is too large/, 'Ez a kép túl nagy.'],
  [/^That picture could not be opened/, 'Ezt a képet nem sikerült megnyitni.'],
  [/^You used today’s cut-outs/, 'Mára elfogytak a kivágások és MI-rajzok. Holnap újra használhatod – az előnézeteidet ez nem érinti.'],
  [/^You shared a lot today/, 'Ma már sokat osztottál meg. Próbáld újra holnap.'],
  [/^Sharing failed/, 'A megosztás nem sikerült. Próbáld újra.'],
  [/^You reached (your plan|this month’s)/, 'Elérted a havi 30 előnézetet. Minden hónap 1-jén újraindul.'],
  [/^So many people are trying InkAge today/, 'Ma nagyon sokan próbálják az InkAge-et, ezért az előnézetek szünetelnek. Próbáld újra holnap.'],
  [/^Previews are paused/, 'Az előnézetek rövid ideig szünetelnek. Próbáld újra később.'],
  [/^Lots of people are making previews/, 'Most nagyon sokan készítenek előnézetet. Próbáld újra egy perc múlva.'],
  [/^The AI safety filter blocked/, 'Az MI biztonsági szűrője letiltotta ezt a fotót. Olyan fotót használj, amin csak a testrész látszik, meztelenség és kiskorú nélkül.'],
  [/^The preview could not be created/, 'Nem sikerült elkészíteni az előnézetet. Próbáld újra, vagy használj élesebb, világosabb fotót.'],
  [/^The server took too long/, 'A szerver túl sokáig dolgozott. Próbáld újra.'],
  [/^No connection/, 'Nincs internetkapcsolat. Ellenőrizd, és próbáld újra.'],
  [/^Add both images again/, 'Add meg újra mindkét képet, és próbáld újra.'],
  [/^These images are too large/, 'Túl nagyok a képek. Használj kisebb fotót.'],
  [/^Could not start your preview/, 'Nem sikerült elindítani az előnézetet. Próbáld újra.'],
  [/^This preview expired/, 'Ez az előnézet lejárt. Kezdj egy újat.'],
  [/^Start a new preview/, 'Kezdj egy új előnézetet, és próbáld újra.'],
  [/^Limit reached for this image/, 'Ehhez a képhez elérted a keretet. Kezdj egy új előnézetet.'],
  [/^Please sign in/, 'Kérlek, jelentkezz be újra.'],
  [/^The AI is not switched on|^The app is not fully set up|^Not set up yet/, 'Az app most karbantartás alatt van. Próbáld újra pár perc múlva.'],
  [/^Network error/, 'Hálózati hiba. Próbáld újra.'],
];
export function trErr(lang: Lang, msg: string | undefined | null) {
  const m = msg || tx(lang, 'Something went wrong. Try again.', 'Valami hiba történt. Próbáld újra.');
  if (lang !== 'hu') return tr(lang, m);
  return ERR_HU.find(([re]) => re.test(m))?.[1] ?? m;
}

/** Hungarian definite article: "az" before a vowel sound, "a" otherwise (instead of the clumsy "a(z)"). */
export const huArticle = (word: string) => (/^[aáeéiíoóöőuúüű]/i.test(String(word || '').trim()) ? 'az' : 'a');
