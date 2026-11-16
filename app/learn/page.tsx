import { langOf, qOf } from '@/lib/tr';
import { redirect } from 'next/navigation';

// The guides moved to the Tudástár.
export default async function Learn(props: { searchParams: Promise<{ lang?: string }> }) {
  const searchParams = await props.searchParams;
  redirect(`/tudastar${qOf(langOf(searchParams))}`);
}
