'use client';
import { useEffect, useState } from 'react';

export type Lang = 'en' | 'hu';

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
  'create.free': 'Your first preview is free. No sign-up needed.',
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
  'result.savedLocal': 'Saved on this device. Sign in to keep it everywhere.',
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
  'profile.inviteSub': 'You both get an extra free preview when they sign up with your link.',
  'profile.copy': 'Copy link',
  'profile.copied': 'Copied',
  'profile.install': 'Add InkAge to your home screen',
  'profile.erase': 'Delete my account and data',
  'profile.eraseConfirm': 'Type DELETE to confirm. This removes your account and every saved preview.',
  'paywall.used': 'You reached today’s limit',
  'paywall.sub': 'InkAge is free during the beta, with a daily limit to keep it running. Come back tomorrow — or invite a friend: you both get extra previews.',
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
  'create.free': 'Az első előnézet ingyenes, regisztráció nélkül.',
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
  'result.savedLocal': 'Elmentve ezen az eszközön. Jelentkezz be, hogy mindenhol meglegyen.',
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
  'profile.inviteSub': 'Ha a linkeddel regisztrál, mindketten kaptok egy újabb ingyenes előnézetet.',
  'profile.copy': 'Link másolása',
  'profile.copied': 'Másolva',
  'profile.install': 'InkAge a kezdőképernyőre',
  'profile.erase': 'Fiókom és adataim törlése',
  'profile.eraseConfirm': 'Írd be: TÖRLÉS. Ez törli a fiókodat és minden mentett előnézetet.',
  'paywall.used': 'Elérted a mai keretet',
  'paywall.sub': 'Az InkAge a tesztidőszakban ingyenes, napi kerettel. Gyere vissza holnap – vagy hívj meg egy barátot, és mindketten kaptok plusz előnézeteket.',
};

const DICTS: Record<Lang, Record<Key, string>> = { en: EN as any, hu: HU };

export function detectLang(): Lang {
  try {
    const saved = localStorage.getItem('ink_lang') as Lang | null;
    if (saved === 'en' || saved === 'hu') return saved;
  } catch {}
  return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('hu') ? 'hu' : 'en';
}

let current: Lang = 'en';
const listeners = new Set<(l: Lang) => void>();

export function setLang(l: Lang) {
  current = l;
  try {
    localStorage.setItem('ink_lang', l);
  } catch {}
  document.documentElement.lang = l;
  listeners.forEach((f) => f(l));
}

export function useLang() {
  const [lang, set] = useState<Lang>(current);
  useEffect(() => {
    current = detectLang();
    set(current);
    document.documentElement.lang = current;
    listeners.add(set);
    return () => {
      listeners.delete(set);
    };
  }, []);
  const t = (k: Key) => DICTS[lang][k] ?? EN[k];
  return { lang, t, setLang };
}

/** Pick between an English and Hungarian string inline (for longer copy). */
export const tx = (lang: Lang, en: string, hu: string) => (lang === 'hu' ? hu : en);

/** Server messages are English; show them in Hungarian when the app is in Hungarian. */
const ERR_HU: [RegExp, string][] = [
  [/^Wait for the 50-year images first/, 'Várd meg, amíg mindkét 50 éves kép elkészül.'],
  [/^That link can’t be opened/, 'Ezt a linket nem tudjuk megnyitni. Másold ki magát a képet, vagy mentsd el és töltsd fel.'],
  [/^We couldn’t find a picture on that page/, 'Ezen az oldalon nem találtunk képet. Másold ki magát a képet, vagy mentsd el és töltsd fel.'],
  [/^That link isn’t a picture/, 'Ez a link nem képre mutat.'],
  [/^That picture is too large/, 'Ez a kép túl nagy.'],
  [/^That picture could not be opened/, 'Ezt a képet nem sikerült megnyitni.'],
  [/^You used today’s cut-outs/, 'Mára elfogytak a kivágások és MI-rajzok. Holnap újra használhatod – az előnézeteidet ez nem érinti.'],
  [/^You shared a lot today/, 'Ma már sokat osztottál meg. Próbáld újra holnap.'],
  [/^Sharing failed/, 'A megosztás nem sikerült. Próbáld újra.'],
  [/^You used your free preview/, 'Elhasználtad az ingyenes előnézeteidet mára. Próbáld újra holnap.'],
  [/^You reached your plan limit/, 'Elérted a mai keretedet. Próbáld újra később.'],
  [/^So many people are trying InkAge today/, 'Ma nagyon sokan próbálják az InkAge-et, ezért az ingyenes előnézetek szünetelnek. Próbáld újra holnap.'],
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
  const m = msg || (lang === 'hu' ? 'Valami hiba történt. Próbáld újra.' : 'Something went wrong. Try again.');
  if (lang !== 'hu') return m;
  return ERR_HU.find(([re]) => re.test(m))?.[1] ?? m;
}
