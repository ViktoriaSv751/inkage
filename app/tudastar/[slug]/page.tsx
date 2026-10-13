import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { article, ARTICLES } from '@/lib/articles';
import { fmtDate, IMG, KB, KB_STILL, readMin } from '@/lib/kb';
import { KbChrome } from '../KbChrome';
import { Helpful, ShareBtn } from '../ArticleBits';
import '../kb.css';

export function generateMetadata({ params, searchParams }: { params: { slug: string }; searchParams: { lang?: string } }): Metadata {
  const a = article(params.slug);
  if (!a) return {};
  const L = searchParams.lang === 'en' ? 'en' : 'hu';
  const img = KB[a.slug]?.img;
  return {
    title: `${a.title[L]} – InkAge`,
    description: a.desc[L],
    alternates: { canonical: `/tudastar/${a.slug}` },
    openGraph: { title: a.title[L], description: a.desc[L], images: img ? [{ url: IMG(img, 1200) }] : undefined },
  };
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** **bold** inside a paragraph */
function rich(p: string) {
  return p.split(/(\*\*[^*]+\*\*)/g).map((x, i) => (x.startsWith('**') ? <b key={i}>{x.slice(2, -2)}</b> : x));
}

export default function ArticlePage({ params, searchParams }: { params: { slug: string }; searchParams: { lang?: string } }) {
  const a = article(params.slug);
  if (!a) notFound();
  const L = searchParams.lang === 'en' ? 'en' : 'hu';
  const T = (en: string, hu: string) => (L === 'hu' ? hu : en);
  const sfx = L === 'en' ? '?lang=en' : '';
  const meta = KB[a.slug];

  // intro = paragraphs before the first heading; then sections
  const body = a.body[L];
  const first = body.findIndex((p) => p.startsWith('## '));
  const intro = first === -1 ? body : body.slice(0, first);
  const sections: { h: string; id: string; ps: string[] }[] = [];
  for (const p of first === -1 ? [] : body.slice(first)) {
    if (p.startsWith('## ')) sections.push({ h: p.slice(3), id: slugify(p.slice(3)), ps: [] });
    else sections[sections.length - 1]?.ps.push(p);
  }
  // if there is no intro paragraph, the first section's opening becomes the intro
  const lead = intro.length ? intro : sections[0]?.ps.slice(0, 1) || [];
  if (!intro.length && sections[0]) sections[0].ps = sections[0].ps.slice(1);
  const toc = [...sections.map((s) => ({ h: s.h, id: s.id })), ...(meta?.faq.length ? [{ h: T('Frequently asked questions', 'Gyakori kérdések'), id: 'gyik' }] : [])];
  const imageAfter = Math.min(1, sections.length - 1);
  const related = ARTICLES.filter((x) => x.slug !== a.slug && x.tag.en === a.tag.en)
    .concat(ARTICLES.filter((x) => x.slug !== a.slug && x.tag.en !== a.tag.en))
    .slice(0, 3);

  return (
    <div className="ka-page">
      <KbChrome lang={L} back={`/tudastar${sfx}`} crumb={a.tag[L]} light path={`/tudastar/${a.slug}`} />
      <main className="ka-main" lang={L}>
        <figure className="ka-hero">
          <img src={IMG(meta?.img || KB_STILL, 1600)} alt="" />
        </figure>
        <header className="ka-card ka-head">
          <p className="ka-bc">
            <Link href={`/tudastar${sfx}`}>{T('Knowledge base', 'Tudástár')}</Link> › {a.tag[L]}
          </p>
          <p className="ka-eyebrow">{a.tag[L]}</p>
          <h1>{a.title[L]}</h1>
          <div className="ka-metarow">
            <span>
              {readMin(a, L)} {T('min read', 'perc olvasás')} • {T('Updated', 'Frissítve')}: {fmtDate(meta?.date || '2026-10-12', L)}
            </span>
            <ShareBtn title={a.title[L]} lang={L} />
          </div>
        </header>

        {toc.length > 1 && (
          <nav className="ka-card ka-toc" aria-label={T('In this article', 'Ebben a cikkben')}>
            <p className="ka-toc-h">{T('In this article', 'Ebben a cikkben')}</p>
            <ol>
              {toc.map((x) => (
                <li key={x.id}>
                  <a href={`#${x.id}`}>{x.h}</a>
                </li>
              ))}
            </ol>
          </nav>
        )}

        {lead.length > 0 && (
          <div className="ka-card ka-intro">
            {lead.map((p, i) => (
              <p key={i} className={i === 0 ? 'drop' : ''}>
                {rich(p)}
              </p>
            ))}
          </div>
        )}

        {sections.map((s, i) => (
          <section key={s.id} id={s.id} className="ka-sec">
            <h2>{s.h}</h2>
            {s.ps.map((p, j) => (
              <p key={j}>{rich(p)}</p>
            ))}
            {i === imageAfter && meta && (
              <figure className="ka-fig">
                <img src={IMG(meta.img2, 1400)} alt="" loading="lazy" />
                <figcaption>{meta.cap2[L]}</figcaption>
              </figure>
            )}
          </section>
        ))}

        <aside className="ka-cta">
          <div>
            <h2>{T('See it on your own skin', 'Nézd meg a saját bőrödön')}</h2>
            <p>{T('Put any design on a photo of your body and see it fresh, then at 10, 30 and 50 years. Free, about a minute.', 'Tegyél bármilyen mintát a saját fotódra, és nézd meg frissen, majd 10, 30 és 50 év múlva. Ingyenes, kb. egy perc.')}</p>
            <Link className="ka-cta-btn" href="/app">
              {T('Try it on my photo', 'Kipróbálom a fotómon')}
            </Link>
          </div>
          <img src={IMG('hf_20261013_090637_00bc55f1-c4f6-4bb3-af84-c63dff9cd69b', 800)} alt="" loading="lazy" />
        </aside>

        {meta?.faq.length ? (
          <section id="gyik" className="ka-sec">
            <h2>{T('Frequently asked questions', 'Gyakori kérdések')}</h2>
            <div className="ka-faq">
              {meta.faq.map((f) => (
                <details key={f.q.en}>
                  <summary>{f.q[L]}</summary>
                  <p>{f.a[L]}</p>
                </details>
              ))}
            </div>
          </section>
        ) : null}

        <section className="ka-related">
          <h2>{T('Read next', 'Olvasd el ezeket is')}</h2>
          <div className="ka-rel-grid">
            {related.map((r) => (
              <Link key={r.slug} href={`/tudastar/${r.slug}${sfx}`} className="ka-rel">
                <img src={IMG(KB[r.slug]?.img || KB_STILL, 600)} alt="" loading="lazy" />
                <span className="ka-rel-cat">{r.tag[L]}</span>
                <b>{r.title[L]}</b>
              </Link>
            ))}
          </div>
        </section>

        <Helpful slug={a.slug} lang={L} />
        <p className="ka-disc">{T('General information, not medical advice. Ask your artist or a dermatologist about your own skin.', 'Általános tájékoztatás, nem orvosi tanács. A saját bőrödről kérdezd a tetoválódat vagy egy bőrgyógyászt.')}</p>
      </main>
      <footer className="ka-foot">
        <div>
          <b>{T('Product', 'Termék')}</b>
          <Link href="/app">{T('Open the app', 'App megnyitása')}</Link>
          <Link href="/app/explore">{T('Explore', 'Felfedezés')}</Link>
        </div>
        <div>
          <b>{T('Knowledge', 'Tudás')}</b>
          <Link href={`/tudastar${sfx}`}>{T('Knowledge base', 'Tudástár')}</Link>
          <Link href={`/tattoo/fine-line-forearm${L === 'hu' ? '?lang=hu' : ''}`}>{T('Styles by body area', 'Stílusok testrészenként')}</Link>
        </div>
        <div>
          <b>{T('Legal', 'Jog')}</b>
          <Link href="/terms">{T('Terms', 'Feltételek')}</Link>
          <Link href="/privacy">{T('Privacy', 'Adatvédelem')}</Link>
        </div>
      </footer>
    </div>
  );
}
