import { langOf, qOf } from '@/lib/tr';
import { redirect } from 'next/navigation';

export default async function LearnArticle(
  props: { params: Promise<{ slug: string }>; searchParams: Promise<{ lang?: string }> }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  redirect(`/tudastar/${params.slug}${qOf(langOf(searchParams))}`);
}
