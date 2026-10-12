import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { article, ARTICLES } from '@/lib/articles';

export const dynamic = 'force-dynamic';

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const a = article(params.slug);
  if (!a) return {};
  return { title: `${a.title.en} – InkAge`, description: a.desc.en, alternates: { canonical: `/learn/${a.slug}` } };
}

export default function LearnPage({ params, searchParams }: { params: { slug: string }; searchParams: { lang?: string } }) {
  const a = article(params.slug);
  if (!a) notFound();
  const hu = searchParams.lang === 'hu';
  const L = hu ? 'hu' : 'en';
  const others = ARTICLES.filter((x) => x.slug !== a.slug).slice(0, 3);
  return (
    <main className="legal">
      <p style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Link href="/">← InkAge</Link>
        <Link href={`/learn/${a.slug}${hu ? '' : '?lang=hu'}`} hrefLang={hu ? 'en' : 'hu'}>
          {hu ? 'English' : 'Magyarul'}
        </Link>
      </p>
      <p className="kicker" style={{ color: 'var(--violet)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', fontSize: 13 }}>
        {a.tag[L]}
      </p>
      <h1 style={{ fontSize: 'clamp(40px, 8vw, 64px)' }} lang={L}>
        {a.title[L]}
      </h1>
      <article lang={L}>
        {a.body[L].map((p, i) => (p.startsWith('## ') ? <h2 key={i}>{p.slice(3)}</h2> : <p key={i}>{p}</p>))}
      </article>
      <div style={{ background: 'var(--ink)', color: '#fff', borderRadius: 24, padding: 22, margin: '32px 0' }}>
        <h2 style={{ color: '#fff', marginTop: 0 }}>{hu ? 'Nézd meg a saját bőrödön' : 'See it on your own skin'}</h2>
        <p style={{ color: 'rgba(255,255,255,.8)' }}>
          {hu
            ? 'Tölts fel egy fotót és egy mintát, és nézd meg, hogyan néz ki frissen, 10, 30 és 50 év múlva. Az első ingyenes.'
            : 'Upload a photo and a design and see it fresh, at 10, 30 and 50 years. Your first preview is free.'}
        </p>
        <Link className="btn" href="/app">
          {hu ? 'Kipróbálom' : 'Try InkAge free'}
        </Link>
      </div>
      <h2>{hu ? 'További olvasnivaló' : 'Keep reading'}</h2>
      <ul>
        {others.map((o) => (
          <li key={o.slug}>
            <Link href={`/learn/${o.slug}${hu ? '?lang=hu' : ''}`}>{o.title[L]}</Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
