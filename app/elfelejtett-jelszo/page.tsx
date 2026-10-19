import { qOf, langOf } from '@/lib/tr';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

/** Sign-in is only with Google or Apple: there is no password to reset, so an old link leads to sign-in. */
export default function Page({ searchParams }: { searchParams: { lang?: string } }) {
  redirect(`/belepes${qOf(langOf(searchParams))}`);
}
