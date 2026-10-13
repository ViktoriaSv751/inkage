import type { Metadata } from 'next';
import { InfoPage, langOf, type InfoSec } from '../_info/InfoPage';

export const dynamic = 'force-dynamic';
export function generateMetadata({ searchParams }: { searchParams: { lang?: string } }): Metadata {
  return { title: langOf(searchParams) === 'hu' ? 'Felhasználási feltételek (ÁSZF) – InkAge' : 'Terms of use – InkAge' };
}

export default function Terms({ searchParams }: { searchParams: { lang?: string } }) {
  const L = langOf(searchParams);
  const T = (en: string, hu: string) => (L === 'hu' ? hu : en);
  const sections: InfoSec[] = [
    { h: T('The service', 'A szolgáltatás'), ps: [T('InkAge creates AI-generated simulations of how a tattoo could look on your photo, now and as it ages. Results are illustrations for planning and inspiration only. They are not a promise of how a real tattoo will look or age, and they are not medical or professional advice. Always consult a licensed tattoo artist.', 'Az InkAge MI által készített szimulációkat hoz létre arról, hogyan nézhet ki egy tetoválás a fotódon most és az évek során. Az eredmények kizárólag tervezést és inspirációt szolgáló illusztrációk. Nem ígéretek arra, hogyan fog kinézni vagy öregedni egy valódi tetoválás, és nem orvosi vagy szakmai tanácsok. Mindig konzultálj engedéllyel rendelkező tetoválóval.')] },
    { h: T('Age', 'Életkor'), ps: [T('You must be at least 18 years old to use InkAge.', 'Az InkAge használatához legalább 18 évesnek kell lenned.')] },
    { h: T('Your content', 'A tartalmaid'), ps: [T('Only upload photos of yourself or of people who have given you permission, and only designs you have the right to use. Tattoo designs are often the work of artists: respect their copyright and ask before copying a custom piece. Do not upload photos of minors or nude images; we refuse such photos automatically. You keep all rights to your uploads and results.', 'Csak saját magadról, vagy olyan emberekről tölts fel fotót, akik ehhez hozzájárultak, és csak olyan mintát, amelynek használatára jogosult vagy. A tetoválásminták gyakran alkotók munkái: tartsd tiszteletben a szerzői jogukat, és egyedi minta lemásolása előtt kérdezz. Ne tölts fel kiskorúakról vagy meztelenségről készült képet; az ilyen fotókat automatikusan elutasítjuk. A feltöltéseidhez és az eredményekhez fűződő minden jog a tiéd marad.')] },
    { h: T('It is a simulation', 'Ez egy szimuláció'), ps: [T('The ageing previews and the longevity score are estimates based on general rules of thumb and an AI model. Real results depend on your artist, technique, ink, skin, health, sun exposure and aftercare.', 'Az öregedési előnézetek és a tartóssági pontszám általános ökölszabályokon és egy MI-modellen alapuló becslések. A valós eredmény a tetoválódtól, a technikától, a tintától, a bőrödtől, az egészségedtől, a napfénytől és az utókezeléstől függ.')] },
    { h: T('Price', 'Díjak'), ps: [T('InkAge is free during the beta. If paid features are introduced later, prices will be shown clearly before any purchase, and nothing will be charged without your explicit consent.', 'Az InkAge a béta időszakban ingyenes. Ha később fizetős funkciók jelennek meg, az árakat minden vásárlás előtt egyértelműen feltüntetjük, és semmit nem terhelünk a kifejezett hozzájárulásod nélkül.')] },
    { h: T('Fair use', 'Méltányos használat'), ps: [T('To keep the service free we apply a daily limit on new previews. We may suspend accounts that abuse the service, for example through automated requests.', 'Hogy a szolgáltatás ingyenes maradhasson, napi keretet alkalmazunk az új előnézetekre. Felfüggeszthetjük azokat a fiókokat, amelyek visszaélnek a szolgáltatással, például automatizált kérésekkel.')] },
    { h: T('Liability', 'Felelősség'), ps: [T('The service is provided “as is”. To the extent permitted by law, we are not liable for decisions made based on the simulations.', 'A szolgáltatást „ahogy van” alapon nyújtjuk. A jogszabályok által megengedett mértékben nem vállalunk felelősséget a szimulációk alapján hozott döntésekért.')] },
    { h: T('Contact', 'Kapcsolat'), ps: [T('Questions about these terms: use the contact page.', 'A feltételekkel kapcsolatos kérdésekkel a kapcsolat oldalon keress minket.')] },
  ];
  return <InfoPage lang={L} path="/terms" kicker={T('Legal', 'Jog')} title={T('Terms of use', 'Felhasználási feltételek')} sections={sections} updated={T('October 2026', '2026. október')} toc cta={false} />;
}
