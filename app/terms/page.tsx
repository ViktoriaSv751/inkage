import { tx } from '@/lib/tr';
import type { Metadata } from 'next';
import { InfoPage, langOf, type InfoSec } from '../_info/InfoPage';
import { webPaymentsOn, PLAN } from '@/lib/pricing';

export const dynamic = 'force-dynamic';
export function generateMetadata({ searchParams }: { searchParams: { lang?: string } }): Metadata {
  return { title: tx(langOf(searchParams), 'Terms of use – InkAge', 'Felhasználási feltételek (ÁSZF) – InkAge') };
}

export default function Terms({ searchParams }: { searchParams: { lang?: string } }) {
  const L = langOf(searchParams);
  const T = (en: string, hu: string) => tx(L, en, hu);
  const sections: InfoSec[] = [
    { h: T('The service', 'A szolgáltatás'), ps: [T('InkAge creates AI-generated simulations of how a tattoo could look on your photo, now and as it ages. Results are illustrations for planning and inspiration only. They are not a promise of how a real tattoo will look or age, and they are not medical or professional advice. Always consult a licensed tattoo artist.', 'Az InkAge MI által készített szimulációkat hoz létre arról, hogyan nézhet ki egy tetoválás a fotódon most és az évek során. Az eredmények kizárólag tervezést és inspirációt szolgáló illusztrációk. Nem ígéretek arra, hogyan fog kinézni vagy öregedni egy valódi tetoválás, és nem orvosi vagy szakmai tanácsok. Mindig konzultálj engedéllyel rendelkező tetoválóval.')] },
    { h: T('Age', 'Életkor'), ps: [T('You must be at least 18 years old to use InkAge.', 'Az InkAge használatához legalább 18 évesnek kell lenned.')] },
    { h: T('Your content', 'A tartalmaid'), ps: [T('Only upload photos of yourself or of people who have given you permission, and only designs you have the right to use. Tattoo designs are often the work of artists: respect their copyright and ask before copying a custom piece. Do not upload photos of minors or nude images; we refuse such photos automatically. You keep all rights to your uploads and results.', 'Csak saját magadról, vagy olyan emberekről tölts fel fotót, akik ehhez hozzájárultak, és csak olyan mintát, amelynek használatára jogosult vagy. A tetoválásminták gyakran alkotók munkái: tartsd tiszteletben a szerzői jogukat, és egyedi minta lemásolása előtt kérdezz. Ne tölts fel kiskorúakról vagy meztelenségről készült képet; az ilyen fotókat automatikusan elutasítjuk. A feltöltéseidhez és az eredményekhez fűződő minden jog a tiéd marad.')] },
    { h: T('Community rules', 'Közösségi szabályok'), ps: [T('Posts shared in Explore and on vote links must follow these rules. There is zero tolerance for objectionable content or abusive users. Objectionable content includes nudity or sexual content, anything showing or sexualising minors, intimate images shared without consent (including AI-generated ones), hate symbols, harassment, threats, violence, spam, other people’s personal details and work copied without permission. Every post is checked before it appears. Anyone can report a post or hide all posts from its author in the app; we review reports within 24 hours, remove content that breaks the rules and suspend the accounts behind it.', 'A Felfedezésben és a szavazó-linkeken megosztott posztoknak követniük kell ezeket a szabályokat. A kifogásolható tartalmakkal és a visszaélő felhasználókkal szemben zéró tolerancia érvényes. Kifogásolható tartalom: meztelenség vagy szexuális tartalom, bármi, ami kiskorút mutat vagy szexualizál, beleegyezés nélkül megosztott intim kép (MI által készített is), gyűlöletkeltő jelkép, zaklatás, fenyegetés, erőszak, kéretlen reklám, mások személyes adatai, és engedély nélkül lemásolt alkotás. Minden posztot megjelenés előtt ellenőrzünk. Az appban bárki jelenthet egy posztot, vagy elrejtheti a szerző összes posztját; a jelentéseket 24 órán belül átnézzük, a szabálysértő tartalmat eltávolítjuk, a mögötte álló fiókot felfüggesztjük.')] },
    { h: T('It is a simulation', 'Ez egy szimuláció'), ps: [T('The ageing previews and the longevity score are estimates based on general rules of thumb and an AI model. Real results depend on your artist, technique, ink, skin, health, sun exposure and aftercare.', 'Az öregedési előnézetek és a tartóssági pontszám általános ökölszabályokon és egy MI-modellen alapuló becslések. A valós eredmény a tetoválódtól, a technikától, a tintától, a bőrödtől, az egészségedtől, a napfénytől és az utókezeléstől függ.')] },
    ...(webPaymentsOn
      ? paidSections(T)
      : [
      { h: T('Beta', 'Béta'), ps: [T('InkAge is in beta. Features may change, and we will tell you in the app before any change that affects how you use it. Nothing is ever charged without your explicit consent.', 'Az InkAge béta időszakban van. A funkciók változhatnak; minden olyan változásról, amely a használatot érinti, előre szólunk az appban. Semmit nem terhelünk a kifejezett hozzájárulásod nélkül.')] },
      { h: T('Fair use', 'Méltányos használat'), ps: [T('An account is needed to make previews. Each account can make 30 new previews a month (plus invite bonuses); the allowance restarts on the 1st of each month. We may suspend accounts that abuse the service, for example through automated requests or multiple accounts.', 'Előnézet készítéséhez fiók szükséges. Fiókonként havonta 30 új előnézet készíthető (plusz a meghívási bónuszok); a keret minden hónap 1-jén újraindul. Felfüggeszthetjük azokat a fiókokat, amelyek visszaélnek a szolgáltatással, például automatizált kérésekkel vagy több fiókkal.')] },
        ]),
    { h: T('Liability', 'Felelősség'), ps: [T('The service is provided “as is”. To the extent permitted by law, we are not liable for decisions made based on the simulations.', 'A szolgáltatást „ahogy van” alapon nyújtjuk. A jogszabályok által megengedett mértékben nem vállalunk felelősséget a szimulációk alapján hozott döntésekért.')] },
    { h: T('Contact', 'Kapcsolat'), ps: [T('Questions about these terms: use the contact page.', 'A feltételekkel kapcsolatos kérdésekkel a kapcsolat oldalon keress minket.')] },
  ];
  return <InfoPage lang={L} path="/terms" kicker={T('Legal', 'Jog')} title={T('Terms of use', 'Felhasználási feltételek')} sections={sections} updated={webPaymentsOn ? T('November 2026', '2026. november') : T('October 2026', '2026. október')} toc cta={false} kickerIcon="scale" related={[
    { href: '/privacy', t: T('Privacy policy', 'Adatvédelem'), p: T('How we handle your data.', 'Hogyan kezeljük az adataidat.'), i: 'lock' },
    { href: '/suti', t: T('Cookie notice', 'Süti tájékoztató'), p: T('Cookies and browser storage, explained.', 'Sütik és böngészőtároló, elmagyarázva.'), i: 'cookie' },
    { href: '/jog', t: T('All legal pages', 'Minden jogi oldal'), p: T('Everything in one place.', 'Minden egy helyen.'), i: 'scale' },
  ]} />;
}

/* the purchase terms, shown once web payments are on (lib/pricing.ts webPaymentsOn) */
function paidSections(T: (en: string, hu: string) => string): InfoSec[] {
  const usd = (n: number) => `${n} USD`;
  const usdHu = (n: number) => `${String(n).replace('.', ',')} USD`;
  const list = `Mini: ${PLAN.mini.n} previews, ${usd(PLAN.mini.usd)}; Plus: ${PLAN.plus.n} previews, ${usd(PLAN.plus.usd)}; Studio: ${PLAN.studio.n} previews, ${usd(PLAN.studio.usd)}`;
  const listHu = `Mini: ${PLAN.mini.n} előnézet, ${usdHu(PLAN.mini.usd)}; Plus: ${PLAN.plus.n} előnézet, ${usdHu(PLAN.plus.usd)}; Studio: ${PLAN.studio.n} előnézet, ${usdHu(PLAN.studio.usd)}`;
  return [
    { h: T('Seller', 'A szolgáltató'), ps: [T('InkAge is operated by Sóti Viktória Vivien e.v. (sole trader), registered seat: 2194 Tura, Hősök útja 21., Hungary, tax number: 92541942-1-33. Contact: through the contact page.', 'Az InkAge üzemeltetője: Sóti Viktória Vivien e.v. (egyéni vállalkozó), székhely: 2194 Tura, Hősök útja 21., adószám: 92541942-1-33. Kapcsolat: a kapcsolat oldalon.')] },
    {
      h: T('Trial and packages', 'Kipróbálás és csomagok'),
      ps: [
        T('An account is needed to make previews. From 10 November 2026 there is no free trial preview: every preview comes from a package. Invite bonuses add extra previews once you have bought a package.', 'Előnézet készítéséhez fiók szükséges. 2026. november 10-től nincs ingyenes próba-előnézet: minden előnézet csomagból készül. A meghívási bónuszok egy megvásárolt csomag mellé adnak további előnézeteket.'),
        T(`More previews come in one-time packages (${list}). A package preview includes every stage: 1, 10, 30 and 50 years and the laser sessions after 3, 6 and 10 treatments. Packages are not a subscription, nothing renews, and previews bought do not expire while your account exists. The seller is exempt from VAT (alanyi adómentes), so no VAT is added.`, `További előnézetek egyszeri csomagokban vásárolhatók (${listHu}). A csomagban vett előnézet minden állapotot tartalmaz: 1, 10, 30 és 50 év, valamint a 3, 6 és 10 lézeres kezelés utáni állapot. A csomag nem előfizetés, semmi nem újul meg automatikusan, és a megvett előnézetek nem járnak le, amíg a fiókod létezik. A szolgáltató alanyi adómentes, áfát nem számít fel.`),
        T('Payment is by card through Stripe, on the website only. An electronic invoice is sent by e-mail. The store apps do not sell packages.', 'A fizetés bankkártyával, a Stripe-on keresztül történik, csak a weboldalon. Az elektronikus számlát e-mailben küldjük. Az áruházi appokban csomag nem vásárolható.'),
      ],
    },
    { h: T('Right of withdrawal', 'Elállási jog'), ps: [T('The previews are digital content delivered right after payment. Before paying you ask for immediate delivery and acknowledge that you thereby lose the 14-day right of withdrawal (Government Decree 45/2014, section 29 (1) m)). A preview that could not be made because of a technical error is not counted. If something went wrong with a purchase, write to us and we will sort it out, with a refund where it is fair.', 'Az előnézetek digitális tartalmak, amelyeket a fizetés után azonnal megkapsz. Fizetés előtt kéred az azonnali teljesítést, és tudomásul veszed, hogy ezzel elveszíted a 14 napos elállási jogot (45/2014. (II. 26.) Korm. rendelet 29. § (1) m) pont). A műszaki hiba miatt el nem készült előnézetet nem számoljuk. Ha egy vásárlással gond volt, írj nekünk, és rendezzük, indokolt esetben visszatérítéssel.')] },
    { h: T('Fair use', 'Méltányos használat'), ps: [T('We may suspend accounts that abuse the service, for example through automated requests, or several accounts made to get more trial previews.', 'Felfüggeszthetjük azokat a fiókokat, amelyek visszaélnek a szolgáltatással, például automatizált kérésekkel, vagy több fiókkal, amelyeket további kipróbálható előnézetekért hoztak létre.')] },
  ];
}
