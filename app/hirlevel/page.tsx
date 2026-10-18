import { langOf, qOf, tx } from '@/lib/tr';
import Link from 'next/link';

export const metadata = { title: 'Hírlevél – InkAge', robots: { index: false } };

export default function Newsletter({ searchParams }: { searchParams: { status?: string; lang?: string } }) {
  const st = searchParams.status;
  const L = langOf(searchParams);
  const T = (en: string, hu: string) => tx(L, en, hu);
  const [h, p] =
    st === 'confirmed'
      ? [T('You’re subscribed', 'Feliratkoztál'), T('Once a month we send you a new guide. Every e-mail has a one-click unsubscribe link at the bottom.', 'Havonta egyszer küldünk egy új útmutatót. Minden levél alján egy kattintással leiratkozhatsz.')]
      : st === 'unsubscribed'
        ? [T('You’re unsubscribed', 'Leiratkoztál'), T('We won’t send you more e-mails. If you change your mind, you can subscribe again at the bottom of the website.', 'Több levelet nem küldünk. Ha meggondolod magad, a weboldal alján újra feliratkozhatsz.')]
        : [T('This link is no longer valid', 'Ez a link már nem érvényes'), T('You may have used it already. You can subscribe again at the bottom of the website any time.', 'Lehet, hogy már használtad. A weboldal alján bármikor újra feliratkozhatsz.')];
  return (
    <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center', background: 'var(--bg)', color: 'var(--ink)' }}>
      <div style={{ maxWidth: 440, display: 'grid', gap: 12, justifyItems: 'center' }}>
        <h1 style={{ margin: 0, fontSize: 34, letterSpacing: '-.03em' }}>{h}</h1>
        <p style={{ margin: 0, color: 'var(--ink-2)', lineHeight: 1.55 }}>{p}</p>
        <Link className="btn" href={`/${qOf(L)}`} style={{ marginTop: 8 }}>
          {T('Back to the home page', 'Vissza a főoldalra')}
        </Link>
      </div>
    </main>
  );
}
