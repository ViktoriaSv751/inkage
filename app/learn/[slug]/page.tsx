import { redirect } from 'next/navigation';

export default function LearnArticle({ params, searchParams }: { params: { slug: string }; searchParams: { lang?: string } }) {
  redirect(`/tudastar/${params.slug}${searchParams.lang === 'hu' ? '' : '?lang=en'}`);
}
