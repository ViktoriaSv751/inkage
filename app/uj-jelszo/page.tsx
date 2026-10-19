import { tx, langOf } from '@/lib/tr';
import type { Metadata } from 'next';
import { NewPassword } from '../_auth/NewPassword';

export const dynamic = 'force-dynamic';
export function generateMetadata({ searchParams }: { searchParams: { lang?: string } }): Metadata {
  return { title: tx(langOf(searchParams), 'New password – InkAge', 'Új jelszó – InkAge'), robots: { index: false } };
}

export default function Page({ searchParams }: { searchParams: { lang?: string } }) {
  return <NewPassword lang={langOf(searchParams)} />;
}
