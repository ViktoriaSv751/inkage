import { langOf, qOf } from '@/lib/tr';
import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/site';
import { TudastarView } from '../../tudastar/TudastarView';

export const dynamic = 'force-dynamic';
// the public /tudastar list is the canonical one
export async function generateMetadata(props: { searchParams: Promise<{ lang?: string }> }): Promise<Metadata> {
  const searchParams = await props.searchParams;
  return { title: 'Tudástár – InkAge', alternates: { canonical: `${SITE_URL}/tudastar${qOf(langOf(searchParams))}` } };
}

/** The knowledge base inside the app: same articles, the app's own frame, the person stays signed in. */
export default async function AppTudastar(props: { searchParams: Promise<{ lang?: string }> }) {
  const searchParams = await props.searchParams;
  return <TudastarView lang={langOf(searchParams)} inApp />;
}
