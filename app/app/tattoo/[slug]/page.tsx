import { langOf } from '@/lib/tr';
import { SeoView } from '../../../tattoo/[slug]/SeoView';

export const dynamic = 'force-dynamic';

/** A style × body-area guide inside the app. */
export default async function AppGuide(
  props: { params: Promise<{ slug: string }>; searchParams: Promise<{ lang?: string }> }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  return <SeoView slug={params.slug} L={langOf(searchParams)} inApp />;
}
