import type { Metadata } from 'next';
import { AuthScreen } from '../_auth/AuthScreen';

export const dynamic = 'force-dynamic';
export function generateMetadata({ searchParams }: { searchParams: { lang?: string } }): Metadata {
  return { title: searchParams.lang === 'en' ? 'Reset password – InkAge' : 'Elfelejtett jelszó – InkAge', robots: { index: false } };
}

export default function Page({ searchParams }: { searchParams: { lang?: string } }) {
  return <AuthScreen mode="forgot" lang={searchParams.lang === 'en' ? 'en' : 'hu'} img="hf_20261013_201235_9c9d9ee5-d036-400c-888a-564bf15102ce" />;
}
