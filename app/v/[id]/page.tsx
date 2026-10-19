import { fromBrowser, tx } from '@/lib/tr';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { getPoll, getShare, SharedView } from './SharedView';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const host = headers().get('x-forwarded-host') || headers().get('host') || 'inkage.app';
  if (params.id.startsWith('p')) {
    const p = await getPoll(params.id);
    const lang = fromBrowser(headers().get('accept-language') || '');
    const n = p?.options.length || 1;
    const title = `${p?.question || (n > 1 ? (tx(lang, 'Which one should I get?', 'Melyiket csináltassam meg?')) : tx(lang, 'Should I get this tattoo?', 'Csináltassam meg ezt a tetoválást?'))} 👀`;
    const description = tx(lang, 'Take a look and vote – one tap, no sign-up.', 'Nézd meg, és szavazz – egy koppintás, regisztráció nélkül.');
    const og = p ? [`https://${host}/api/og/${params.id}`] : undefined;
    return { title, description, robots: { index: false }, openGraph: { title, description, images: og?.map((url) => ({ url, width: 1200, height: 630 })) }, twitter: { card: 'summary_large_image', title, description, images: og } };
  }
  const s = await getShare(params.id);
  const abs = (u?: string) => (u && u.startsWith('/') ? `https://${host}${u}` : u);
  if (s) s.paths = { fresh: abs(s.paths.fresh), y50: abs(s.paths.y50), freshB: abs(s.paths.freshB), y50B: abs(s.paths.y50B) };
  const lang = fromBrowser(headers().get('accept-language') || '');
  const title = tx(lang, 'Should I get this tattoo? 👀', 'Csináltassam meg ezt a tetoválást? 👀');
  const description = tx(lang, 'See how it looks fresh and after 50 years, then vote. Made with InkAge.', 'Nézd meg frissen és 50 év múlva, aztán szavazz. InkAge-dzsel készült.');
  return {
    title,
    description,
    robots: { index: false },
    openGraph: { title, description, images: s?.paths.y50 ? [{ url: `https://${host}/api/og/${params.id}`, width: 1200, height: 630 }] : undefined },
    twitter: { card: 'summary_large_image', title, description, images: s?.paths.y50 ? [`https://${host}/api/og/${params.id}`] : undefined },
  };
}

export default async function SharePage({ params }: { params: { id: string } }) {
  return <SharedView id={params.id} />;
}
