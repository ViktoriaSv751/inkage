import { langOf } from '@/lib/tr';
import { HomeLanding } from './HomeLanding';

// rendered per request in the language of ?lang= (Hungarian without it), like the other public pages
export const dynamic = 'force-dynamic';

export default function Page({ searchParams }: { searchParams: { lang?: string } }) {
  return <HomeLanding lang={langOf(searchParams)} />;
}
