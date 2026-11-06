import { tx, hasExact } from '@/lib/tr';
import { TOOL_LANGS } from '@/lib/tool-pages';
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
  /* questions as people ask an AI assistant; only in the languages they are translated into (the others would mix in English) */
  const askedQ = 'Is there an app that shows how my tattoo will look in 20 years?';
  const asked: { h: string; i: string; items: QA[] } = {
    h: T('Asked most often', 'Leggyakrabban kérdezik'), i: 'ask',
    items: [
      [T('Is there an app that shows how my tattoo will look in 20 years?', 'Van olyan app, ami megmutatja, hogyan fog kinézni a tetoválásom 20 év múlva?'), T('Yes. InkAge shows a tattoo on a photo of your own skin fresh, healed after a year, and at 10, 30 and 50 years, so 20 years sits between the 10- and 30-year images. It works for a new design and for a tattoo you already have.', 'Igen. Az InkAge a saját bőrödről készült fotón mutatja a tetoválást frissen, egy év után gyógyultan, valamint 10, 30 és 50 év múlva, így a 20 év a 10 és a 30 éves kép között van. Új mintával és meglévő tetoválással is működik.')],
      [T('Can I see a tattoo on my arm before getting it?', 'Megnézhetem a tetoválást a karomon, mielőtt elkészíttetném?'), T('Yes. Photograph your arm, add the design (a photo, screenshot, sketch or a design from the library) and place it at real size in centimetres. InkAge draws it into your photo in about a minute.', 'Igen. Fotózd le a karodat, add hozzá a mintát (fotót, képernyőfotót, vázlatot vagy egy mintát a mintatárból), és tedd fel valós méretben, centiméterre pontosan. Az InkAge kb. egy perc alatt belerajzolja a fotódba.')],
      [T('How accurate is a tattoo aging preview?', 'Mennyire pontos egy tetoválás-öregedési előnézet?'), T('It is an AI estimate of how ink, skin and sun usually behave, shown on your own photo — not a measurement of your skin or a guarantee. It is good for comparing sizes, spots and designs; the real result depends on your artist, ink, skin, sun and aftercare.', 'MI-becslés arról, ahogy a tinta, a bőr és a nap általában viselkedik, a saját fotódon megjelenítve – nem a bőröd mérése és nem garancia. Méretek, helyek és minták összehasonlítására jó; a valós eredmény a tetoválódtól, a tintától, a bőrödtől, a naptól és az utókezeléstől függ.')],
      [T('Can an app show laser tattoo removal results?', 'Meg tudja mutatni egy app a lézeres tetoválás-eltávolítás eredményét?'), T('InkAge shows a laser removal preview of your own tattoo after 3, 6 and 10 sessions. It helps you set expectations before you talk to a clinic; the real number of sessions depends on the ink, the colours, your skin and the clinic’s laser.', 'Az InkAge lézeres eltávolítási előnézetet mutat a saját tetoválásodról 3, 6 és 10 kezelés után. Segít reális elvárásokat kialakítani, mielőtt klinikával beszélnél; a valós kezelésszám a tintától, a színektől, a bőrödtől és a klinika lézerétől függ.')],
      [T('Is InkAge on iPhone and Android?', 'Elérhető az InkAge iPhone-on és Androidon?'), T('Yes. InkAge works in the browser on iPhone, Android and computers, and you can add it to your home screen like an app. Where the InkAge app is available in the App Store or Google Play, it uses the same account.', 'Igen. Az InkAge böngészőben működik iPhone-on, Androidon és számítógépen, és appként kiteheted a kezdőképernyőre. Ahol az InkAge app elérhető az App Store-ban vagy a Google Playen, ott ugyanazt a fiókot használja.')],
      [T('Does InkAge keep my photos?', 'Megőrzi az InkAge a fotóimat?'), T('Your previews are saved in your account’s private storage, and only you can see them. To make a preview, the photo and design are sent to our AI providers (Google Gemini, with OpenAI as a backup). You can delete any preview, or remove your account and all data under Profile → Delete my account and data.', 'Az előnézeteid a fiókod privát tárhelyén vannak, és csak te látod őket. Az előnézet elkészítéséhez a fotót és a mintát elküldjük az MI-szolgáltatóinknak (Google Gemini, tartalékként OpenAI). Bármelyik előnézetet törölheted, a fiókodat és minden adatodat pedig itt: Profil → Fiókom és adataim törlése.')],
      [T('How long does a preview take?', 'Mennyi ideig tart egy előnézet?'), T('About a minute from photo to preview. With an account you can make 30 previews a month.', 'Kb. egy perc a fotótól az előnézetig. Fiókkal havonta 30 előnézetet készíthetsz.')],
      [T('Which languages is InkAge available in?', 'Milyen nyelveken érhető el az InkAge?'), T('35 languages, including English, Hungarian, German, Spanish, French, Portuguese, Italian, Dutch, Polish, Czech, Japanese and Swedish. InkAge follows your browser’s language, and you can switch it at any time.', '35 nyelven, köztük magyarul, angolul, németül, spanyolul, franciául, portugálul, olaszul, hollandul, lengyelül, csehül, japánul és svédül. Az InkAge a böngésződ nyelvét követi, és bármikor átválthatod.')],
    ],
  };
  if (TOOL_LANGS.includes(L) && hasExact(L, askedQ)) groups.unshift(asked);
  const jsonLd = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: groups.flatMap((g) => g.items.map(([qq, a]) => ({ '@type': 'Question', name: qq, acceptedAnswer: { '@type': 'Answer', text: a } }))) };
  return (
    <InfoPage lang={L} path="/gyik" kickerIcon="doc" kicker={T('FAQ', 'GYIK')} title={T('Questions, answered.', 'Kérdések és válaszok.')} lede={T('Can’t find yours? Write to us — we read every message.', 'Nem találod a sajátodat? Írj nekünk – minden üzenetet elolvasunk.')}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <FaqExplorer groups={groups} lang={L} />
    </InfoPage>
  );
}
