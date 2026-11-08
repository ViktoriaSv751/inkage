import { langOf, qOf } from '@/lib/tr';
import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/site';
import { TudastarView } from '../../tudastar/TudastarView';

export const dynamic = 'force-dynamic';
// the public /tudastar list is the canonical one
export function generateMetadata({ searchParams }: { searchParams: { lang?: string } }): Metadata {
  return { title: 'Tudástár – InkAge', alternates: { canonical: `${SITE_URL}/tudastar${qOf(langOf(searchParams))}` } };
}

/** The knowledge base inside the app: same articles, the app's own frame, the person stays signed in. */
export default function AppTudastar({ searchParams }: { searchParams: { lang?: string } }) {
  return <TudastarView lang={langOf(searchParams)} inApp />;
}
