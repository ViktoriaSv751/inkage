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
import { IMG, KB } from '@/lib/kb';
import { lsSet, track } from '@/lib/store';
import { HeroAging } from '../../visuals';
import { QuickFacts } from './QuickFacts';

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
    <div className="explore">
      <h1>{ui.t('explore.title')}</h1>
      <p className="sub">{t('Real results, designs to try and how tattoos really age.', 'Valódi eredmények, kipróbálható minták, és hogyan öregszik valójában a tetoválás.')}</p>

      <section className="ex-hero">
        <div className="ex-hero-demo">
          <HeroAging
            frames={[
              { years: 0, src: IMG('hf_20261013_204219_480510e4-c412-4eae-9c90-eab4348178ba', 1000) },
              { years: 10, src: IMG('hf_20261013_204308_32cb3de1-b0a1-4c01-81e7-d3124fe2d65c', 1000) },
              { years: 30, src: IMG('hf_20261013_204311_202be418-e14d-4185-a851-f755279348bb', 1000) },
              { years: 50, src: IMG('hf_20261013_204308_b1d4b7fe-a9f2-4f93-8e19-d070d503ba2e', 1000) },
            ]}
            alt={t('A dotwork mandala tattoo on a calf, fresh', 'Pontozott mandala tetoválás vádlin, frissen')}
          />
        </div>
        <div className="ex-hero-txt">
          <span className="ex-pill">{t('Real example', 'Valódi példa')}</span>
          <h2>{t('One tattoo, fifty years.', 'Egy tetoválás, ötven év.')}</h2>
          <p>{t('Drag the slider and watch the same dotwork mandala change: softer at 10 years, blue-grey at 30 and on ageing skin at 50.', 'Húzd a csúszkát, és nézd meg, hogyan változik ugyanaz a pontozott mandala: 10 évnél lágyabban, 30-nál kékesszürkén, 50-nél öregedő bőrön.')}</p>
          <Link className="btn" href="/app">
            {t('Make my own', 'Elkészítem a sajátomat')}
          </Link>
        </div>
      </section>

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
      <div className="hscroll ex-designs">
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
        <h2>{t('Knowledge base', 'Tudástár')}</h2>
        <Link className="small" href={ui.lang === 'hu' ? '/tudastar' : '/tudastar?lang=en'}>
          {t('All articles', 'Az összes cikk')} →
        </Link>
      </div>
      <div className="hscroll ex-articles">
        {ARTICLES.map((a) => (
          <Link key={a.slug} className="article-card" href={`/tudastar/${a.slug}${ui.lang === 'hu' ? '' : '?lang=en'}`}>
            {KB[a.slug] && <img src={IMG(KB[a.slug].img, 600)} alt="" loading="lazy" />}
            <span className="tag">{a.tag[ui.lang]}</span>
            <b>{a.title[ui.lang]}</b>
            <span>{a.desc[ui.lang]}</span>
          </Link>
        ))}
      </div>

      <QuickFacts lang={ui.lang} />
    </div>
  );
}
