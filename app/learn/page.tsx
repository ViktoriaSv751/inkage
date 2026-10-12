import Link from 'next/link';
import { ARTICLES } from '@/lib/articles';

export const metadata = { title: 'Tattoo aging guides – InkAge', description: 'How tattoos age, which spots last, fine line longevity and aftercare.' };

export default function LearnIndex() {
  return (
    <main className="legal">
      <p>
        <Link href="/">← InkAge</Link>
      </p>
      <h1>Learn</h1>
      {ARTICLES.map((a) => (
        <p key={a.slug}>
          <Link href={`/learn/${a.slug}`} style={{ fontWeight: 700, fontSize: 19, color: 'var(--ink)' }}>
            {a.title.en}
          </Link>
          <br />
          {a.desc.en}
        </p>
      ))}
    </main>
  );
}
