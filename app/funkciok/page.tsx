import type { Metadata } from 'next';
import { InfoPage, langOf, type InfoSec } from '../_info/InfoPage';

export const dynamic = 'force-dynamic';
export function generateMetadata({ searchParams }: { searchParams: { lang?: string } }): Metadata {
  const L = langOf(searchParams);
  return { title: L === 'hu' ? 'Funkciók – InkAge' : 'Features – InkAge', description: L === 'hu' ? 'Öregedési előnézet, tartóssági pontszám, lézeres előnézet, videók, szavazás és PDF a tetoválódnak.' : 'Ageing previews, longevity score, laser preview, videos, voting and a PDF for your artist.' };
}

export default function Page({ searchParams }: { searchParams: { lang?: string } }) {
  const L = langOf(searchParams);
  const T = (en: string, hu: string) => (L === 'hu' ? hu : en);
  const sections: InfoSec[] = [
    {
      h: T('Ageing previews', 'Öregedési előnézet'),
      ps: [
        T('Your design on your photo at five moments: fresh, healed after a year, and at 10, 30 and 50 years. Each image keeps your own skin tone and lighting.', 'A mintád a fotódon öt időpontban: frissen, egy év után gyógyultan, valamint 10, 30 és 50 év múlva. Minden kép megtartja a saját bőrtónusodat és fényeidet.'),
        T('- A year slider to move smoothly between the moments', '- Évcsúszka, amivel finoman mozoghatsz az időpontok között'),
        T('- Sun exposure taken into account', '- A napfény mértékét is figyelembe veszi'),
        T('- Side-by-side view of two versions', '- Két változat egymás melletti nézete'),
      ],
    },
    {
      h: T('Ink longevity score', 'Tartóssági pontszám'),
      ps: [
        T('A score from 0 to 100 that explains itself: every plus and minus is listed — line weight, detail at the chosen size, colours, body area and sun.', 'Egy 0–100-as pontszám, ami meg is indokolja magát: minden plusz és mínusz látszik – vonalvastagság, részletesség a választott méretnél, színek, testrész és napfény.'),
        T('> Below about 8 cm, very detailed designs lose points. The app suggests trying a larger size with one tap.', '> Kb. 8 cm alatt a nagyon részletes minták pontot veszítenek. Az app egy koppintással javasolja a nagyobb méret kipróbálását.'),
      ],
    },
    {
      h: T('Make it last', 'Tedd tartóssá'),
      ps: [T('Redraws a fragile design with bolder key lines, more breathing room and fewer tiny details — then shows how that version ages, so you can take both to your artist.', 'Egy sérülékeny mintát erősebb fő vonalakkal, több levegővel és kevesebb apró részlettel rajzol át – majd megmutatja, hogyan öregszik ez a változat, így mindkettőt elviheted a tetoválódhoz.')],
    },
    {
      h: T('Smart cut-out and skin mask', 'Okos kivágás és bőrmaszk'),
      ps: [T('Use a screenshot, a sketch or a photo of a tattoo on someone else. InkAge frames every design it finds and cuts out only the one you choose. A skin mask keeps the result on skin — never on clothes, hair or background.', 'Használj képernyőfotót, vázlatot vagy valaki más tetoválásáról készült fotót. Az InkAge bekeretez minden mintát, amit talál, és csak azt vágja ki, amelyiket választod. A bőrmaszk gondoskodik róla, hogy az eredmény bőrre kerüljön – soha ne ruhára, hajra vagy háttérre.')],
    },
    {
      h: T('Laser removal preview', 'Lézeres eltávolítás előnézete'),
      ps: [T('See a realistic estimate after 3, 6 and 10 sessions. It is a reality check before you get tattooed — and a starting point for a conversation with a dermatologist if you are considering removal.', 'Reális becslés 3, 6 és 10 kezelés után. Valóságpróba még a tetoválás előtt – és kiindulópont egy bőrgyógyásszal folytatott beszélgetéshez, ha az eltávolításon gondolkodsz.')],
    },
    {
      h: T('Share, vote and plan', 'Megosztás, szavazás, tervezés'),
      ps: [
        T('- **Vote links:** friends choose “get it”, “change it” or which of two versions they prefer', '- **Szavazós link:** a barátaid választanak – „csináltasd”, „változtass”, vagy melyik a jobb két változat közül'),
        T('- **Videos:** five ready templates for TikTok, Reels and Shorts', '- **Videók:** öt kész sablon TikTokra, Reelsre és Shortsra'),
        T('- **PDF for your artist:** design, size, placement and previews on one page', '- **PDF a tetoválódnak:** minta, méret, hely és előnézetek egy oldalon'),
        T('- **Aftercare reminders:** calendar steps for the healing weeks and a yearly sunscreen reminder', '- **Utókezelési emlékeztetők:** naptári lépések a gyógyulás heteire és évente egy fényvédő-emlékeztető'),
      ],
    },
    {
      h: T('Free during the beta', 'Ingyenes a béta alatt'),
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
      img="hf_20261013_090637_ca312303-c618-4a41-946b-8b783b5b3cee"
      sections={sections}
      toc
    />
  );
}
