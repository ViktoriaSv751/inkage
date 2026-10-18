import { langOf, qOf } from '@/lib/tr';
import { redirect } from 'next/navigation';

// The guides moved to the Tudástár.
export default function Learn({ searchParams }: { searchParams: { lang?: string } }) {
  redirect(`/tudastar${qOf(langOf(searchParams))}`);
}
