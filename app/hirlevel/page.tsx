import Link from 'next/link';

export const metadata = { title: 'Hírlevél – InkAge', robots: { index: false } };

export default function Newsletter({ searchParams }: { searchParams: { status?: string } }) {
  const st = searchParams.status;
  const [h, p] =
    st === 'confirmed'
      ? ['Feliratkoztál', 'Havonta egyszer küldünk egy új útmutatót. Minden levél alján egy kattintással leiratkozhatsz.']
      : st === 'unsubscribed'
        ? ['Leiratkoztál', 'Több levelet nem küldünk. Ha meggondolod magad, a weboldal alján újra feliratkozhatsz.']
        : ['Ez a link már nem érvényes', 'Lehet, hogy már használtad. A weboldal alján bármikor újra feliratkozhatsz.'];
  return (
    <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center', background: 'var(--bg)', color: 'var(--ink)' }}>
      <div style={{ maxWidth: 440, display: 'grid', gap: 12, justifyItems: 'center' }}>
        <h1 style={{ margin: 0, fontSize: 34, letterSpacing: '-.03em' }}>{h}</h1>
        <p style={{ margin: 0, color: 'var(--ink-2)', lineHeight: 1.55 }}>{p}</p>
        <Link className="btn" href="/" style={{ marginTop: 8 }}>
          Vissza a főoldalra
        </Link>
      </div>
    </main>
  );
}
