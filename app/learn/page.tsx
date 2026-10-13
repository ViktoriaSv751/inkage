import { redirect } from 'next/navigation';

// The guides moved to the Tudástár.
export default function Learn({ searchParams }: { searchParams: { lang?: string } }) {
  redirect(searchParams.lang === 'hu' ? '/tudastar' : '/tudastar?lang=en');
}
