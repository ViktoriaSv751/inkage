import { langOf } from '@/lib/tr';
import { landingData } from '@/lib/landing-data';
import { HomeLanding } from './HomeLanding';

// rendered per request in the language of ?lang= (Hungarian without it), like the other public pages
export const dynamic = 'force-dynamic';

/* Who InkAge is, for search engines and AI assistants: sameAs ties the site to its Wikidata item and official profiles. */
const ORG_LD = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'InkAge',
  url: 'https://inkage.app',
  logo: 'https://inkage.app/icons/icon-512.png',
  description: 'Tattoo simulator and tattoo aging simulator: a design on a photo of your own skin, fresh and after 10, 30 and 50 years.',
  sameAs: [
    'https://www.wikidata.org/wiki/Q142090126',
    'https://www.pinterest.com/inkageapp/',
    'https://www.indiehackers.com/product/inkage',
    'https://peerlist.io/vviktoriasoti/project/inkage',
  ],
};

export default function Page({ searchParams }: { searchParams: { lang?: string } }) {
  const lang = langOf(searchParams);
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ORG_LD) }} />
      <HomeLanding lang={lang} data={landingData(lang)} />
    </>
  );
}
