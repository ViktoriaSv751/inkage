import { tx, langOf } from '@/lib/tr';
import type { Metadata } from 'next';
import { TudastarView } from './TudastarView';
import { seoTitle } from '@/lib/seo-titles';

export const dynamic = 'force-dynamic';
export async function generateMetadata(props: { searchParams: Promise<{ lang?: string }> }): Promise<Metadata> {
  const searchParams = await props.searchParams;
  const L = langOf(searchParams);
  return {
    title: seoTitle('/tudastar', L) || `${tx(L, 'Knowledge base', 'Tudástár')} – InkAge`,
    description: tx(
      L,
      'Long, honest articles about what really happens to ink over the years, which size and placement last, and how to keep your tattoo looking new. Read them before you book.',
      'Hosszú, őszinte cikkek arról, mi történik valójában a tintával az évek alatt, milyen méret és hely bírja a legjobban, és hogyan marad újszerű a tetoválásod. Olvasd el, mielőtt időpontot foglalsz.'
    ),
  };
}

export default async function Tudastar(props: { searchParams: Promise<{ lang?: string }> }) {
  const searchParams = await props.searchParams;
  return <TudastarView lang={langOf(searchParams)} />;
}
