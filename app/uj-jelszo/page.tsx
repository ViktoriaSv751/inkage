import type { Metadata } from 'next';
import { NewPassword } from '../_auth/NewPassword';

export const dynamic = 'force-dynamic';
export function generateMetadata({ searchParams }: { searchParams: { lang?: string } }): Metadata {
  return { title: searchParams.lang === 'en' ? 'New password – InkAge' : 'Új jelszó – InkAge', robots: { index: false } };
}

export default function Page({ searchParams }: { searchParams: { lang?: string } }) {
  return <NewPassword lang={searchParams.lang === 'en' ? 'en' : 'hu'} />;
}
