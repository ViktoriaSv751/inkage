import { tx, langOf } from '@/lib/tr';
import type { Metadata } from 'next';
import { NewPassword } from '../_auth/NewPassword';

export const dynamic = 'force-dynamic';
export async function generateMetadata(props: { searchParams: Promise<{ lang?: string }> }): Promise<Metadata> {
  const searchParams = await props.searchParams;
  return { title: tx(langOf(searchParams), 'New password – InkAge', 'Új jelszó – InkAge'), robots: { index: false } };
}

export default async function Page(props: { searchParams: Promise<{ lang?: string }> }) {
  const searchParams = await props.searchParams;
  return <NewPassword lang={langOf(searchParams)} />;
}
