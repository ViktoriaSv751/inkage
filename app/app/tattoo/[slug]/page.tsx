import { langOf } from '@/lib/tr';
import { SeoView } from '../../../tattoo/[slug]/SeoView';

export const dynamic = 'force-dynamic';

/** A style × body-area guide inside the app. */
export default function AppGuide({ params, searchParams }: { params: { slug: string }; searchParams: { lang?: string } }) {
  return <SeoView slug={params.slug} L={langOf(searchParams)} inApp />;
}
