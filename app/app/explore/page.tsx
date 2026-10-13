'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { sb } from '@/lib/sb';
import { placeName } from '../create/steps';
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
  const [feed, setFeed] = useState<any[] | null>(null);
  const [trends, setTrends] = useState<{ places: { placement: string; n: number }[]; designs: { id: string; n: number }[]; previews_total: number } | null>(null);
  useEffect(() => {
    sb()?.rpc('community_feed').then(({ data }) => setFeed(Array.isArray(data) ? data : []));
    sb()?.rpc('trends').then(({ data }) => data && setTrends(data as any));
  }, []);
  const popular = (trends?.designs || []).map((d) => DESIGNS.find((x) => x.id === d.id)).filter(Boolean) as typeof DESIGNS;
  const tryDesign = (id: string) => {
    lsSet('ink_pick', id);
    track('explore_design', { id });
    router.push('/app');
  };

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

      {feed && feed.length > 0 && (
        <>
          <div className="section-title">
            <h2>{t('From the community', 'A közösségtől')}</h2>
            <span className="small muted">{t('tap to vote', 'koppints és szavazz')}</span>
          </div>
          <div className="hscroll">
            {feed.map((f) => (
              <Link key={f.share_id} className="post-card" href={`/v/${f.share_id}`} onClick={() => track('community_open')}>
                <img src={f.share?.paths?.y50} alt="" loading="lazy" />
                <span className="post-meta">
                  <b>50 {t('yrs', 'év')}</b>
                  {f.caption || placeName(f.share?.placement || '', ui.lang)}
                </span>
              </Link>
            ))}
          </div>
        </>
      )}

      {trends && (trends.places.length > 0 || popular.length > 0) && (
        <>
          <div className="section-title">
            <h2>{t('Trending this week', 'A hét kedvencei')}</h2>
            {trends.previews_total > 50 && <span className="small muted">{t(`${trends.previews_total} previews made`, `${trends.previews_total} előnézet készült`)}</span>}
          </div>
          {trends.places.length > 0 && (
            <div className="row" style={{ gap: 6, marginBottom: 10 }}>
              {trends.places.map((p, i) => (
                <span key={p.placement} className="chip">
                  {i + 1}. {placeName(p.placement, ui.lang)}
                </span>
              ))}
            </div>
          )}
          {popular.length > 0 && (
            <div className="hscroll">
              {popular.map((d) => (
                <button key={d.id} className="ex-design" aria-label={t(`Try ${d.en}`, `${d.hu} kipróbálása`)} onClick={() => tryDesign(d.id)}>
                  <img src={d.thumb || d.src} alt="" loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </>
      )}

      <div className="section-title">
        <h2>{t('Try a design', 'Próbálj ki egy mintát')}</h2>
      </div>
      <div className="hscroll">
        {DESIGNS.map((d) => (
          <button
            key={d.id}
            className="ex-design"
            aria-label={t(`Try ${d.en}`, `${d.hu} kipróbálása`)}
            onClick={() => tryDesign(d.id)}
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
