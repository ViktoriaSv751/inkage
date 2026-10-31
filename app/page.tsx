import { langOf } from '@/lib/tr';
import { landingData } from '@/lib/landing-data';
import { HomeLanding } from './HomeLanding';

// rendered per request in the language of ?lang= (Hungarian without it), like the other public pages
export const dynamic = 'force-dynamic';

export default function Page({ searchParams }: { searchParams: { lang?: string } }) {
  const lang = langOf(searchParams);
  return <HomeLanding lang={lang} data={landingData(lang)} />;
}
