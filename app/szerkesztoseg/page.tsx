import { tx, langOf } from '@/lib/tr';
import type { Metadata } from 'next';
import { toolAlternates, TOOL_TITLE } from '@/lib/tool-pages';
import { InfoPage, type InfoSec } from '../_info/InfoPage';

export const dynamic = 'force-dynamic';
const PATH = '/szerkesztoseg';

export function generateMetadata({ searchParams }: { searchParams: { lang?: string } }): Metadata {
  const L = langOf(searchParams);
  return {
    title: tx(L, TOOL_TITLE[PATH], 'Szerkesztési irányelvek: így készülnek az InkAge cikkei') + ' – InkAge',
    description: tx(
      L,
      'How the InkAge knowledge base is researched, written, illustrated, checked and corrected.',
      'Hogyan kutatjuk, írjuk, illusztráljuk, ellenőrizzük és javítjuk az InkAge tudástár cikkeit.'
    ),
    ...toolAlternates(PATH, L, TOOL_TITLE[PATH]),
  };
}

export default function Page({ searchParams }: { searchParams: { lang?: string } }) {
  const L = langOf(searchParams);
  const T = (en: string, hu: string) => tx(L, en, hu);
  const sections: InfoSec[] = [
    {
      h: T('What we write about', 'Miről írunk'),
      icon: 'doc',
      ps: [
        T(
          'We write about what people actually ask before and after getting a tattoo: how ink ages, which sizes and placements last, healing, pain, styles, costs and laser removal. Topics come from real search questions in many languages, not from advertisers.',
          'Arról írunk, amit az emberek valóban kérdeznek egy tetoválás előtt és után: hogyan öregszik a tinta, milyen méret és hely tart a legtovább, gyógyulás, fájdalom, stílusok, árak és lézeres eltávolítás. A témákat valódi, sok nyelven feltett keresési kérdésekből választjuk, nem hirdetők kérésére.'
        ),
      ],
    },
    {
      h: T('How an article is made', 'Hogyan készül egy cikk'),
      icon: 'check',
      ps: [
        T(
          'Every article starts with research in public sources: regulators and health agencies, dermatology publications, laser manufacturers and clinics, and experienced tattoo artists. Numbers, prices, laws and medical statements are only written after they have been checked against at least one such source.',
          'Minden cikk nyilvános forrásokban végzett kutatással kezdődik: hatóságok és egészségügyi intézmények, bőrgyógyászati publikációk, lézergyártók és klinikák, valamint tapasztalt tetoválók. Számot, árat, jogszabályt vagy orvosi állítást csak akkor írunk le, ha legalább egy ilyen forrással ellenőriztük.'
        ),
        T(
          'We draft with the help of AI writing tools, and the InkAge team checks every draft against the sources before it is published. Where the evidence is thin, the article says so and gives a range rather than a precise figure.',
          'A vázlatokat MI-alapú íróeszközök segítségével készítjük, és az InkAge csapata minden vázlatot a forrásokkal összevetve ellenőriz, mielőtt megjelenik. Ahol kevés a bizonyíték, a cikk ezt ki is mondja, és pontos szám helyett sávot ad meg.'
        ),
        T(
          'Where an article relies on specific sources, they are listed and linked at the end of the article.',
          'Ahol egy cikk konkrét forrásokra épül, azokat a cikk végén felsoroljuk és belinkeljük.'
        ),
      ],
    },
    {
      h: T('Pictures', 'Képek'),
      icon: 'camera',
      ps: [
        T(
          'Illustrations are drawn by us or made with AI and are labelled as illustrations. They show typical changes, not a real person’s tattoo, and never a promise of how your skin will age.',
          'Az illusztrációkat mi rajzoljuk vagy MI-vel készítjük, és illusztrációként jelöljük őket. Tipikus változásokat mutatnak, nem egy valódi ember tetoválását, és soha nem ígéretet arra, hogyan fog öregedni a bőröd.'
        ),
      ],
    },
    {
      h: T('Independence', 'Függetlenség'),
      icon: 'shield',
      ps: [
        T(
          'No studio, clinic or brand pays to be mentioned, and we do not use affiliate links. InkAge itself is mentioned where the preview genuinely helps, and only briefly.',
          'Egyetlen stúdió, klinika vagy márka sem fizet azért, hogy megemlítsük, és nem használunk partnerlinkeket. Magát az InkAge-et csak ott említjük, ahol az előnézet valóban segít, és akkor is röviden.'
        ),
      ],
    },
    {
      h: T('Not medical advice', 'Nem orvosi tanács'),
      icon: 'heart',
      ps: [
        T(
          'The knowledge base is general information. For your own skin, an allergy, a reaction or laser treatment, ask a dermatologist or a qualified clinic, and your tattoo artist.',
          'A tudástár általános tájékoztatás. A saját bőrödről, allergiáról, reakcióról vagy lézeres kezelésről kérdezz bőrgyógyászt vagy szakképzett klinikát, és a tetoválódat.'
        ),
      ],
    },
    {
      h: T('Updates and corrections', 'Frissítés és javítás'),
      icon: 'clock',
      ps: [
        T(
          'Articles about prices, rules and treatments are reviewed regularly, and the date at the end of each article shows the last real update. If you spot a mistake, write to us through the contact page and we will check it and correct the article.',
          'Az árakról, szabályokról és kezelésekről szóló cikkeket rendszeresen átnézzük, és minden cikk végén a dátum a legutóbbi érdemi frissítést mutatja. Ha hibát találsz, írj nekünk a kapcsolati oldalon, és ellenőrizzük, majd kijavítjuk a cikket.'
        ),
      ],
    },
  ];
  return (
    <InfoPage
      lang={L}
      path={PATH}
      kicker={T('Editorial standards', 'Szerkesztési irányelvek')}
      kickerIcon="doc"
      title={T('How the InkAge knowledge base is made', 'Így készül az InkAge tudástára')}
      lede={T(
        'Who writes our articles, where the facts come from, and what we do when something is wrong.',
        'Ki írja a cikkeinket, honnan jönnek a tények, és mit teszünk, ha valami hibás.'
      )}
      sections={sections}
      related={[
        { href: '/tudastar', t: T('Knowledge base', 'Tudástár'), p: T('All articles.', 'Az összes cikk.'), i: 'doc' },
        { href: '/szotar', t: T('Tattoo glossary', 'Tetoválás szótár'), p: T('Terms explained in a sentence or two.', 'Kifejezések egy-két mondatban.'), i: 'spark' },
        { href: '/kapcsolat', t: T('Contact', 'Kapcsolat'), p: T('Report a mistake.', 'Hiba bejelentése.'), i: 'mail' },
      ]}
    />
  );
}
