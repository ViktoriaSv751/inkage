'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useApp } from '../AppProvider';
import { tx } from '@/lib/i18n';
import { ALL_DESIGNS as DESIGNS } from '@/lib/designs';
import { ARTICLES } from '@/lib/articles';
import { lsSet, track } from '@/lib/store';
import { HeroAging } from '../../visuals';

export default function ExplorePage() {
  const { ui } = useApp();
  const t = (en: string, hu: string) => tx(ui.lang, en, hu);
  const router = useRouter();

  return (
    <>
      <p className="kicker">InkAge</p>
      <h1>{ui.t('explore.title')}</h1>
      <p className="sub">{t('Real results, designs to try and how tattoos really age.', 'Valódi eredmények, kipróbálható minták, és hogyan öregszik valójában a tetoválás.')}</p>

      <div className="section-title">
        <h2>{t('Real example', 'Valódi példa')}</h2>
        <span className="small muted">{t('drag the slider', 'húzd a csúszkát')}</span>
      </div>
      <HeroAging />

      <div className="section-title">
        <h2>{t('Try a design', 'Próbálj ki egy mintát')}</h2>
      </div>
      <div className="hscroll">
        {DESIGNS.map((d) => (
          <button
            key={d.id}
            className="ex-design"
            aria-label={t(`Try ${d.en}`, `${d.hu} kipróbálása`)}
            onClick={() => {
              lsSet('ink_pick', d.id);
              track('explore_design', { id: d.id });
              router.push('/app');
            }}
          >
            <img src={d.thumb || d.src} alt="" loading="lazy" onError={(e) => { const i = e.currentTarget; if (i.src !== d.src) i.src = d.src; }} />
          </button>
        ))}
      </div>

      <div className="section-title">
        <h2>{t('Learn', 'Tudnivalók')}</h2>
      </div>
      <div className="hscroll">
        {ARTICLES.map((a) => (
          <Link key={a.slug} className="article-card" href={`/learn/${a.slug}${ui.lang === 'hu' ? '?lang=hu' : ''}`}>
            <span className="tag">{a.tag[ui.lang]}</span>
            <b>{a.title[ui.lang]}</b>
            <span>{a.desc[ui.lang]}</span>
          </Link>
        ))}
      </div>

      <div className="card dark" style={{ marginTop: 24 }}>
        <h2 style={{ color: '#fff' }}>{t('Quick facts', 'Gyors tények')}</h2>
        <p>{t('Black ink lasts longest; pastels fade first.', 'A fekete tinta tart a legtovább, a pasztell fakul először.')}</p>
        <p>{t('Sun is the #1 cause of fading — use SPF 50.', 'A fakulás első számú oka a nap – használj 50-es fényvédőt.')}</p>
        <p>{t('Lines closer than ~1 mm tend to merge within 10–15 years.', 'A kb. 1 mm-nél közelebbi vonalak 10–15 év alatt összefolyhatnak.')}</p>
        <p>{t('Fingers and hands fade fastest; back and upper arm age best.', 'Az ujjak és a kézfej fakul a leggyorsabban; a hát és a felkar öregszik a legszebben.')}</p>
      </div>
    </>
  );
}
