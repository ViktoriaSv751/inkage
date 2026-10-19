import { tx, pick, qOf, localeOf, type Lang } from '@/lib/tr';
import { TryLink } from '../../AuthCta';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import '@fontsource/newsreader/400.css';
import '@fontsource/newsreader/400-italic.css';
import '@fontsource/newsreader/600.css';
import { LONG, longArticle, words } from '@/lib/longform';
import { fmtDate, IMG, IMGSET, KB, KB_STILL } from '@/lib/kb';
import { readMin } from '@/lib/kb-server';
import { KbChrome } from '../KbChrome';
import { Helpful, ShareBtn } from '../ArticleBits';
import { SiteFooter } from '../../SiteFooter';
import { Blocks, rich, type Fig } from './Blocks';
import { ReadProgress, TocNav } from './Reader';
import '../kb.css';
import './article.css';

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/**
 * One knowledge-base article. On the public site it has the site's header and footer; inside the app (inApp) it sits
 * in the app's own frame, so a signed-in person reading from Explore never leaves their account, and every link
 * (breadcrumb, next and related articles) stays inside the app too.
 */
export function ArticleView({ slug, L, inApp = false }: { slug: string; L: Lang; inApp?: boolean }) {
  const a = longArticle(slug);
  if (!a) notFound();
  const base = inApp ? '/app/tudastar' : '/tudastar';
  const T = (en: string, hu: string) => tx(L, en, hu);
  const sfx = qOf(L);
  const meta = KB[a.slug];
  const mins = readMin(a, L);
  const n = words(a, L);

  const body = pick(a.body, L);
  const first = body.findIndex((p) => p.startsWith('## '));
  const intro = first === -1 ? body : body.slice(0, first);
  const sections: { h: string; id: string; ps: string[] }[] = [];
  for (const p of first === -1 ? [] : body.slice(first)) {
    if (p.startsWith('## ')) sections.push({ h: p.slice(3), id: slugify(p.slice(3)), ps: [] });
    else sections[sections.length - 1]?.ps.push(p);
  }
  const faqId = T('faq', 'gyik');
  const toc = [...sections.map((s) => ({ h: s.h, id: s.id })), { h: T('Frequently asked questions', 'Gyakori kérdések'), id: faqId }];
  const figs: Record<string, Fig> = meta
    ? {
        img2: { src: IMG(meta.img2, 1400), set: IMGSET(meta.img2, 1400), cap: pick(a.captions.img2, L) },
        img3: { src: IMG(meta.img3, 1400), set: IMGSET(meta.img3, 1400), cap: pick(a.captions.img3, L) },
        img4: { src: IMG(meta.img4, 1400), set: IMGSET(meta.img4, 1400), cap: pick(a.captions.img4, L) },
      }
    : {};
  const idx = LONG.findIndex((x) => x.slug === a.slug);
  const next = LONG[(idx + 1) % LONG.length];
  const related = LONG.filter((x) => x.slug !== a.slug && x.slug !== next.slug && x.tag.en === a.tag.en)
    .concat(LONG.filter((x) => x.slug !== a.slug && x.slug !== next.slug && x.tag.en !== a.tag.en))
    .slice(0, 3);
  const tip = T('Tip', 'Tipp');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Article', headline: pick(a.title, L), description: pick(a.desc, L), inLanguage: L, wordCount: n, datePublished: meta?.date, dateModified: meta?.date, image: meta ? [`https://inkage.app${IMG(meta.img, 1200)}`] : undefined, author: { '@type': 'Organization', name: 'InkAge' }, publisher: { '@type': 'Organization', name: 'InkAge' } },
      { '@type': 'FAQPage', mainEntity: a.faq.map((f) => ({ '@type': 'Question', name: pick(f.q, L), acceptedAnswer: { '@type': 'Answer', text: pick(f.a, L) } })) },
    ],
  };

  return (
    <div className={`ka-page ka2 ${inApp ? 'ka-inapp' : ''}`}>
      {!inApp && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />}
      {!inApp && <KbChrome lang={L} back={null} light path={`/tudastar/${a.slug}`} />}
      <ReadProgress />

      <header className="ka-cover">
        <img src={IMG(meta?.img || KB_STILL, 1400)} srcSet={IMGSET(meta?.img || KB_STILL)} sizes="100vw" alt="" fetchPriority="high" decoding="async" />
        <div className="ka-cover-in">
          <nav className="ka-bc2" aria-label={T('Breadcrumb', 'Morzsamenü')}>
            <Link href={`${base}${sfx}`}>{T('Knowledge base', 'Tudástár')}</Link>
            <span aria-hidden="true">/</span>
            <span>{pick(a.tag, L)}</span>
          </nav>
          <h1>{pick(a.title, L)}</h1>
          <p className="ka-dek">{pick(a.desc, L)}</p>
          <div className="ka-meta2">
            <span className="ka-by">
              <svg viewBox="0 0 64 64" aria-hidden="true">
                <circle cx="32" cy="32" r="30" />
                <path d="M38 14a20 20 0 1 0 0 36a16 16 0 1 1 0-36z" />
              </svg>
              {T('InkAge editorial team', 'InkAge szerkesztőség')}
            </span>
            <span>{fmtDate(meta?.date || '2026-10-12', L)}</span>
            <span>
              {mins} {T('min read', 'perc olvasás')}
            </span>
            <span>
              {n.toLocaleString(localeOf(L))} {T('words', 'szó')}
            </span>
          </div>
        </div>
      </header>

      <div className="ka-layout">
        <aside className="ka-left">
          <TocNav items={toc} title={T('In this article', 'Ebben a cikkben')} minutes={mins} minLabel={T('min left', 'perc van hátra')} />
        </aside>

        <article className="ka-article" lang={L}>
          <section className="ka-sum" aria-label={T('In short', 'Röviden')}>
            <p className="ka-sum-h">{T('In short', 'Röviden')}</p>
            <ul>
              {pick(a.summary, L).map((s, i) => (
                <li key={i}>{rich(s)}</li>
              ))}
            </ul>
          </section>

          <details className="ka-toc-m">
            <summary>
              {T('In this article', 'Ebben a cikkben')} <small>{toc.length}</small>
            </summary>
            <ol>
              {toc.map((x) => (
                <li key={x.id}>
                  <a href={`#${x.id}`}>{x.h}</a>
                </li>
              ))}
            </ol>
          </details>

          <div className="ka-lead">
            {intro.map((p, i) => (
              <p key={i} className={i === 0 ? 'drop' : ''}>
                {rich(p)}
              </p>
            ))}
          </div>

          {sections.map((s, i) => (
            <section key={s.id} id={s.id} className="ka-s">
              <h2>
                <span className="ka-s-n" aria-hidden="true">
                  {String(i + 1).padStart(2, '0')}
                </span>
                {s.h}
              </h2>
              <Blocks ps={s.ps} figs={figs} tip={tip} />
              {i === Math.floor(sections.length / 2) && (
                <aside className="ka-inline-cta">
                  <div>
                    <b>{T('Wondering how yours would age?', 'Kíváncsi vagy, a tiéd hogyan öregedne?')}</b>
                    <p>{T('Upload a photo and see any design on your skin at 10, 30 and 50 years.', 'Tölts fel egy fotót, és nézd meg bármelyik mintát a bőrödön 10, 30 és 50 év múlva.')}</p>
                  </div>
                  <TryLink lang={L}>{inApp ? T('Try it on my photo', 'Kipróbálom a fotómon') : T('Register free', 'Ingyenes regisztráció')}</TryLink>
                </aside>
              )}
            </section>
          ))}

          <section id={faqId} className="ka-s ka-faq2">
            <h2>{T('Frequently asked questions', 'Gyakori kérdések')}</h2>
            {a.faq.map((f, i) => (
              <details key={i} open={i === 0}>
                <summary>{pick(f.q, L)}</summary>
                <p>{pick(f.a, L)}</p>
              </details>
            ))}
          </section>

          <section className="ka-editorial">
            <svg viewBox="0 0 64 64" aria-hidden="true">
              <circle cx="32" cy="32" r="30" />
              <path d="M38 14a20 20 0 1 0 0 36a16 16 0 1 1 0-36z" />
            </svg>
            <div>
              <b>{T('About this article', 'A cikkről')}</b>
              <p>
                {T(
                  'Written by the InkAge editorial team from widely accepted tattoo-care practice. Figures are rules of thumb, not measurements. This is general information, not medical advice — ask your artist or a dermatologist about your own skin.',
                  'Az InkAge szerkesztősége írta, széles körben elfogadott tetoválási gyakorlat alapján. A számok ökölszabályok, nem mérések. Általános tájékoztatás, nem orvosi tanács – a saját bőrödről kérdezd a tetoválódat vagy egy bőrgyógyászt.'
                )}
              </p>
              <p className="ka-upd">
                {T('Last updated', 'Utoljára frissítve')}: {fmtDate(meta?.date || '2026-10-12', L)}
              </p>
            </div>
          </section>

          <div className="ka-actions">
            <Helpful slug={a.slug} lang={L} />
            <ShareBtn title={pick(a.title, L)} lang={L} />
          </div>
        </article>

        <aside className="ka-right">
          <div className="ka-rail">
            <img src={IMG('hf_20261013_090637_00bc55f1-c4f6-4bb3-af84-c63dff9cd69b', 600)} alt="" loading="lazy" />
            <div>
              <b>{T('See it on your skin', 'Nézd meg a bőrödön')}</b>
              <p>{T('Fresh, then at 10, 30 and 50 years. Free, about a minute.', 'Frissen, majd 10, 30 és 50 év múlva. Ingyenes, kb. egy perc.')}</p>
              <TryLink lang={L}>{inApp ? T('Try it now', 'Kipróbálom') : T('Register and try it', 'Regisztrálok és kipróbálom')}</TryLink>
            </div>
          </div>
        </aside>
      </div>

      <section className="ka-next">
        <Link href={`${base}/${next.slug}${sfx}`} className="ka-next-card">
          <img src={IMG(KB[next.slug]?.img || KB_STILL, 1600)} alt="" loading="lazy" />
          <div>
            <span>{T('Next article', 'Következő cikk')}</span>
            <b>{pick(next.title, L)}</b>
            <p>{pick(next.desc, L)}</p>
            <em>
              {readMin(next, L)} {T('min read', 'perc olvasás')}
            </em>
          </div>
        </Link>
        <h2>{T('More from the knowledge base', 'További cikkek a Tudástárból')}</h2>
        <div className="ka-rel3">
          {related.map((r) => (
            <Link key={r.slug} href={`${base}/${r.slug}${sfx}`} className="ka-rel">
              <img src={IMG(KB[r.slug]?.img || KB_STILL, 700)} alt="" loading="lazy" />
              <span className="ka-rel-cat">
                {pick(r.tag, L)} · {readMin(r, L)} {T('min', 'perc')}
              </span>
              <b>{pick(r.title, L)}</b>
            </Link>
          ))}
        </div>
      </section>

      {!inApp && <SiteFooter lang={L} />}
    </div>
  );
}
