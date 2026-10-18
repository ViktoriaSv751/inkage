import { langOf, qOf } from '@/lib/tr';
import { redirect } from 'next/navigation';

export default function LearnArticle({ params, searchParams }: { params: { slug: string }; searchParams: { lang?: string } }) {
  redirect(`/tudastar/${params.slug}${qOf(langOf(searchParams))}`);
}
