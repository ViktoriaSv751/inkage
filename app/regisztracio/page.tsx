import { langOf, tx } from '@/lib/tr';
import type { Metadata } from 'next';
import { AuthScreen } from '../_auth/AuthScreen';

export const dynamic = 'force-dynamic';
export async function generateMetadata(props: { searchParams: Promise<{ lang?: string }> }): Promise<Metadata> {
  const searchParams = await props.searchParams;
  return { title: tx(langOf(searchParams), 'Create account – InkAge', 'Regisztráció – InkAge'), robots: { index: false } };
}

export default async function Page(props: { searchParams: Promise<{ lang?: string }> }) {
  const searchParams = await props.searchParams;
  return <AuthScreen mode="signup" lang={langOf(searchParams)} img="hf_20261014_072014_0bc43c3a-08b9-46d1-85a0-73f61f1b5028" />;
}
