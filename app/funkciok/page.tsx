import { tx } from '@/lib/tr';
import type { Metadata } from 'next';
import { InfoPage, langOf, type InfoSec } from '../_info/InfoPage';

export const dynamic = 'force-dynamic';
export function generateMetadata({ searchParams }: { searchParams: { lang?: string } }): Metadata {
  const L = langOf(searchParams);
  return { title: tx(L, 'Features – InkAge', 'Funkciók – InkAge'), description: tx(L, 'Ageing previews, longevity score, laser preview, videos, voting and a PDF for your artist.', 'Öregedési előnézet, tartóssági pontszám, lézeres előnézet, videók, szavazás és PDF a tetoválódnak.') };
}

export default function Page({ searchParams }: { searchParams: { lang?: string } }) {
  const L = langOf(searchParams);
  const T = (en: string, hu: string) => tx(L, en, hu);
  const sections: InfoSec[] = [
    {
      h: T('Ageing previews', 'Öregedési előnézet'),
      icon: 'clock', img: 'hf_20261013_090713_9a5ab662-392f-41d6-9e0b-52da1e87bfe3',
      ps: [
        T('Your design on your photo at five moments: fresh, healed after a year, and at 10, 30 and 50 years. Each image keeps your own skin tone and lighting.', 'A mintád a fotódon öt időpontban: frissen, egy év után gyógyultan, valamint 10, 30 és 50 év múlva. Minden kép megtartja a saját bőrtónusodat és fényeidet.'),
        T('- A year slider to move smoothly between the moments', '- Évcsúszka, amivel finoman mozoghatsz az időpontok között'),
        T('- Sun exposure taken into account', '- A napfény mértékét is figyelembe veszi'),
        T('- Side-by-side view of two versions', '- Két változat egymás melletti nézete'),
      ],
    },
    {
      h: T('Ink longevity score', 'Tartóssági pontszám'),
      icon: 'chart',
      ps: [
        T('A score from 0 to 100 that explains itself: every plus and minus is listed — line weight, detail at the chosen size, colours, body area and sun.', 'Egy 0–100-as pontszám, ami meg is indokolja magát: minden plusz és mínusz látszik – vonalvastagság, részletesség a választott méretnél, színek, testrész és napfény.'),
        T('> Below about 8 cm, very detailed designs lose points. The app suggests trying a larger size with one tap.', '> Kb. 8 cm alatt a nagyon részletes minták pontot veszítenek. Az app egy koppintással javasolja a nagyobb méret kipróbálását.'),
      ],
    },
    {
      h: T('Make it last', 'Tedd tartóssá'),
      icon: 'spark', img: 'hf_20261013_090744_81012d7b-bcf7-48ff-b115-254ef696da03',
      ps: [T('Redraws a fragile design with bolder key lines, more breathing room and fewer tiny details — then shows how that version ages, so you can take both to your artist.', 'Egy sérülékeny mintát erősebb fő vonalakkal, több levegővel és kevesebb apró részlettel rajzol át – majd megmutatja, hogyan öregszik ez a változat, így mindkettőt elviheted a tetoválódhoz.')],
    },
    {
      h: T('Smart cut-out and skin mask', 'Okos kivágás és bőrmaszk'),
      icon: 'scissors',
      ps: [T('Use a screenshot, a sketch or a photo of a tattoo on someone else. InkAge frames every design it finds and cuts out only the one you choose. A skin mask keeps the result on skin — never on clothes, hair or background.', 'Használj képernyőfotót, vázlatot vagy valaki más tetoválásáról készült fotót. Az InkAge bekeretez minden mintát, amit talál, és csak azt vágja ki, amelyiket választod. A bőrmaszk gondoskodik róla, hogy az eredmény bőrre kerüljön – soha ne ruhára, hajra vagy háttérre.')],
    },
    {
      h: T('Laser removal preview', 'Lézeres eltávolítás előnézete'),
      icon: 'laser', img: 'hf_20261013_090723_c91c49fb-f918-4ca5-a1d9-383c4f6a6a31',
      ps: [T('See a realistic estimate after 3, 6 and 10 sessions. It is a reality check before you get tattooed — and a starting point for a conversation with a dermatologist if you are considering removal.', 'Reális becslés 3, 6 és 10 kezelés után. Valóságpróba még a tetoválás előtt – és kiindulópont egy bőrgyógyásszal folytatott beszélgetéshez, ha az eltávolításon gondolkodsz.')],
    },
    {
      h: T('Share, vote and plan', 'Megosztás, szavazás, tervezés'),
      icon: 'share', img: 'hf_20261013_090754_fed474a4-feac-40fa-928d-47ed6d6cef1a',
      ps: [
        T('- **Vote links:** friends choose “get it”, “change it” or which of two versions they prefer', '- **Szavazós link:** a barátaid választanak – „csináltasd”, „változtass”, vagy melyik a jobb két változat közül'),
        T('- **Videos:** five ready templates for TikTok, Reels and Shorts', '- **Videók:** öt kész sablon TikTokra, Reelsre és Shortsra'),
        T('- **PDF for your artist:** design, size, placement and previews on one page', '- **PDF a tetoválódnak:** minta, méret, hely és előnézetek egy oldalon'),
        T('- **Aftercare reminders:** calendar steps for the healing weeks and a yearly sunscreen reminder', '- **Utókezelési emlékeztetők:** naptári lépések a gyógyulás heteire és évente egy fényvédő-emlékeztető'),
      ],
    },
    {
      h: T('Free after sign-up', 'Regisztráció után ingyenes'),
      icon: 'gift',
      id: 'beta',
      ps: [
        T('Every feature on this page is free while InkAge is in beta — no card, no trial timer. To keep it free for everyone there is a fair daily limit; if it is reached, leave your e-mail and we’ll tell you when previews are back.', 'Az oldalon szereplő minden funkció ingyenes, amíg az InkAge béta. Nincs bankkártya, nincs próbaidő. Hogy mindenkinek ingyenes maradhasson, méltányos napi keret van; ha betelik, add meg az e-mail-címed, és szólunk, amint újra lehet előnézetet készíteni.'),
        T('Signing in is optional. It lets you keep previews on every device and earn extra previews by inviting friends.', 'A bejelentkezés nem kötelező. Azt teszi lehetővé, hogy minden eszközödön meglegyenek az előnézeteid, és barátok meghívásával extra előnézeteket szerezz.'),
      ],
    },
  ];
  return (
    <InfoPage
      lang={L}
      path="/funkciok"
      kicker={T('Features', 'Funkciók')}
      title={T('Everything you need to decide.', 'Minden, ami a döntéshez kell.')}
      lede={T('From the first preview to the PDF you hand your artist.', 'Az első előnézettől a PDF-ig, amit a tetoválódnak adsz.')}
      sections={sections}
      toc
      highlights={[
        { i: 'clock', h: T('5 moments', '5 időpont'), p: T('Fresh, 1, 10, 30 and 50 years.', 'Friss, 1, 10, 30 és 50 év.') },
        { i: 'chart', h: T('Score 0–100', '0–100 pontszám'), p: T('With every plus and minus explained.', 'Minden plusszal és mínusszal.') },
        { i: 'doc', h: T('PDF for your artist', 'PDF a tetoválónak'), p: T('Design, size and placement on one page.', 'Minta, méret és hely egy oldalon.') },
      ]}
      related={[
        { href: '/hogyan-mukodik', t: T('How it works', 'Hogyan működik'), p: T('Five steps from photo to preview.', 'Öt lépés a fotótól az előnézetig.'), i: 'camera' },
        { href: '/ingyenes-beta', t: T('Free beta', 'Ingyenes béta'), p: T('What’s included, and the daily limit.', 'Mi jár, és mi a napi keret.'), i: 'gift' },
        { href: '/tudastar', t: T('Knowledge base', 'Tudástár'), p: T('12 in-depth guides.', '12 részletes útmutató.'), i: 'doc' },
      ]}
    />
  );
}
