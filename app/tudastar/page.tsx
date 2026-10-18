import { tx, langOf } from '@/lib/tr';
import type { Metadata } from 'next';
import { TudastarView } from './TudastarView';

export const dynamic = 'force-dynamic';
export function generateMetadata({ searchParams }: { searchParams: { lang?: string } }): Metadata {
  const L = langOf(searchParams);
  return {
    title: `${tx(L, 'Knowledge base', 'Tudástár')} – InkAge`,
    description: tx(
      L,
      'Long, honest articles about what really happens to ink over the years, which size and placement last, and how to keep your tattoo looking new. Read them before you book.',
      'Hosszú, őszinte cikkek arról, mi történik valójában a tintával az évek alatt, milyen méret és hely bírja a legjobban, és hogyan marad újszerű a tetoválásod. Olvasd el, mielőtt időpontot foglalsz.'
    ),
    alternates: { canonical: '/tudastar' },
  };
}

export default function Tudastar({ searchParams }: { searchParams: { lang?: string } }) {
  return <TudastarView lang={langOf(searchParams)} />;
}
