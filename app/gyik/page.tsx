import { tx } from '@/lib/tr';
import type { Metadata } from 'next';
import { InfoPage, langOf } from '../_info/InfoPage';
import { FaqExplorer } from './FaqExplorer';

export const dynamic = 'force-dynamic';
export function generateMetadata({ searchParams }: { searchParams: { lang?: string } }): Metadata {
  const L = langOf(searchParams);
  return { title: tx(L, 'FAQ – InkAge', 'Gyakori kérdések – InkAge') };
}

type QA = [string, string];

export default function Page({ searchParams }: { searchParams: { lang?: string } }) {
  const L = langOf(searchParams);
  const T = (en: string, hu: string) => tx(L, en, hu);
  const groups: { h: string; i: string; items: QA[] }[] = [
    {
      h: T('Getting started', 'Kezdés'), i: 'start',
      items: [
        [T('How many previews can I make?', 'Hány előnézetet készíthetek?'), T('30 previews a month with your account, plus bonus previews when friends join through your invite link. The allowance restarts on the 1st of each month.', 'Fiókkal havonta 30 előnézetet, plusz bónuszt, ha a barátaid a meghívó linkeddel csatlakoznak. A keret minden hónap 1-jén újraindul.')],
        [T('Do I need an account?', 'Kell fiók?'), T('Yes. A quick sign-up with Google or Apple (or e-mail) is needed, so your images stay private in your account.', 'Igen. Egy gyors regisztráció kell Google- vagy Apple-fiókkal (vagy e-maillel), így a képeid privátak maradnak a fiókodban.')],
        [T('Is there an app to download?', 'Van letölthető app?'), T('InkAge runs in the browser and can be added to your home screen like an app — no app store needed.', 'Az InkAge böngészőben fut, és appként kitehető a kezdőképernyőre – alkalmazásbolt nélkül.')],
        [T('How old do I need to be?', 'Hány évesnek kell lennem?'), T('You need to be at least 18 to use InkAge.', 'Az InkAge használatához legalább 18 évesnek kell lenned.')],
      ],
    },
    {
      h: T('Photos and designs', 'Fotók és minták'), i: 'photo',
      items: [
        [T('What photo works best?', 'Milyen fotó működik a legjobban?'), T('Daylight, the spot in focus and filling most of the frame, no heavy filters. The app checks light and focus for you.', 'Nappali fény, éles, a képet nagyrészt kitöltő terület, erős szűrők nélkül. Az app ellenőrzi helyetted a fényt és az élességet.')],
        [T('Can I use a photo of someone else’s tattoo?', 'Használhatok más tetoválásáról készült fotót?'), T('Yes. InkAge frames each design it finds and cuts out only the one you pick. Designs belong to their artists, so use them as inspiration and let your artist draw your version.', 'Igen. Az InkAge bekeretez minden mintát, amit talál, és csak azt vágja ki, amelyiket választod. A minták az alkotóikéi, ezért inspirációnak használd őket, és a tetoválód rajzolja meg a saját változatodat.')],
        [T('Why was my photo refused?', 'Miért utasította el a fotómat?'), T('Photos of minors, nude photos and pictures without visible skin are refused automatically. Very dark or blurry photos may also be asked to be retaken.', 'A kiskorúakat ábrázoló, a meztelen és a látható bőrt nem tartalmazó képeket automatikusan elutasítjuk. A nagyon sötét vagy elmosódott fotóknál új képet kérhetünk.')],
      ],
    },
    {
      h: T('Results', 'Eredmények'), i: 'result',
      items: [
        [T('How accurate are the previews?', 'Mennyire pontosak az előnézetek?'), T('They are AI estimates based on how ink, skin and sun usually behave, not measurements of your skin. Use them to compare options and discuss the details with your artist.', 'MI-alapú becslések arról, ahogy a tinta, a bőr és a nap általában viselkedik, nem a bőröd mérései. Lehetőségek összehasonlítására használd őket, és a részleteket beszéld át a tetoválóddal.')],
        [T('What does the longevity score mean?', 'Mit jelent a tartóssági pontszám?'), T('A 0–100 estimate of how well the design keeps its look, with every plus and minus listed. Higher means it is likely to stay readable for longer.', 'Egy 0–100-as becslés arról, mennyire tartja meg a minta a kinézetét, minden plusszal és mínusszal. A magasabb érték azt jelenti, hogy valószínűleg tovább marad olvasható.')],
        [T('Does it work on darker skin?', 'Működik sötétebb bőrön?'), T('Yes, every stage keeps your skin tone. Our guide on darker skin explains which colours and styles show best.', 'Igen, minden stádium megtartja a bőrtónusodat. A sötétebb bőrről szóló útmutatónk elmagyarázza, mely színek és stílusok mutatnak a legjobban.')],
      ],
    },
    {
      h: T('Privacy and your data', 'Adatvédelem és az adataid'), i: 'privacy',
      items: [
        [T('Who can see my photos?', 'Ki látja a fotóimat?'), T('Only you. Your previews are kept in your account’s private storage. A vote link shares only the fresh and 50-year images.', 'Csak te. Az előnézeteid a fiókod privát tárhelyén vannak. A szavazós link csak a friss és az 50 éves képet osztja meg.')],
        [T('How do I delete my data?', 'Hogyan törölhetem az adataimat?'), T('In the app: Profile → Delete my account and data. It removes your account and every saved preview.', 'Az appban: Profil → Fiókom és adataim törlése. Ez törli a fiókodat és minden mentett előnézetet.')],
      ],
    },
  ];
  const jsonLd = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: groups.flatMap((g) => g.items.map(([qq, a]) => ({ '@type': 'Question', name: qq, acceptedAnswer: { '@type': 'Answer', text: a } }))) };
  return (
    <InfoPage lang={L} path="/gyik" kickerIcon="doc" kicker={T('FAQ', 'GYIK')} title={T('Questions, answered.', 'Kérdések és válaszok.')} lede={T('Can’t find yours? Write to us — we read every message.', 'Nem találod a sajátodat? Írj nekünk – minden üzenetet elolvasunk.')}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <FaqExplorer groups={groups} lang={L} />
    </InfoPage>
  );
}
