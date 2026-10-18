import { langOf } from '@/lib/tr';
import { ArticleView } from '../../../tudastar/[slug]/ArticleView';

export const dynamic = 'force-dynamic';

/** A knowledge-base article inside the app (opened from Explore). */
export default function AppArticle({ params, searchParams }: { params: { slug: string }; searchParams: { lang?: string } }) {
  return <ArticleView slug={params.slug} L={langOf(searchParams)} inApp />;
}
