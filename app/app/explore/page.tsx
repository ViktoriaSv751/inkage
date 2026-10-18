'use client';
import { pick } from '@/lib/tr';
import { qOf } from '@/lib/tr';

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
import { lsGet, lsSet, track } from '@/lib/store';
import { Icon } from '../ui';
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
  const [dq, setDq] = useState('');
  const [dstyle, setDstyle] = useState<'all' | 'fine-line' | 'blackwork' | 'traditional' | 'fav'>('all');
  const [favs, setFavs] = useState<string[]>([]);
  const [feedPlace, setFeedPlace] = useState<string | null>(null);
  useEffect(() => setFavs(lsGet<string[]>('ink_fav_designs', [])), []);
  const toggleFav = (id: string) => {
    const next = favs.includes(id) ? favs.filter((x) => x !== id) : [id, ...favs];
    setFavs(next);
    lsSet('ink_fav_designs', next);
    track('design_fav', { id, on: !favs.includes(id) });
  };
  const norm = (x: string) => x.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const shownDesigns = DESIGNS.filter((d) => (dstyle === 'all' ? true : dstyle === 'fav' ? favs.includes(d.id) : d.style === dstyle)).filter((d) => !dq.trim() || norm(`${d.en} ${d.hu}`).includes(norm(dq.trim())));
  const feedPlaces = Array.from(new Set((feed || []).map((f) => f.share?.placement).filter(Boolean))) as string[];
  const shownFeed = (feed || []).filter((f) => !feedPlace || f.share?.placement === feedPlace);
  const popular = (trends?.designs || []).map((d) => DESIGNS.find((x) => x.id === d.id)).filter(Boolean) as typeof DESIGNS;
  const tryDesign = (id: string) => {
    lsSet('ink_pick', id);
    track('explore_design', { id });
    try {
      sessionStorage.setItem('ink_fresh', '1');
    } catch {}
    router.push('/app');
  };

  return (
    <div className="explore">
      <h1>{ui.t('explore.title')}</h1>
      <p className="sub">{t('Example previews, designs to try and how tattoos really age.', 'Példa-előnézetek, kipróbálható minták, és hogyan öregszik valójában a tetoválás.')}</p>

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
          <span className="ex-pill">{t('AI example', 'MI-példa')}</span>
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
          {feedPlaces.length > 1 && (
            <div className="chips">
              <button className={`chip ${!feedPlace ? 'on' : ''}`} onClick={() => setFeedPlace(null)}>
                {t('All', 'Mind')}
              </button>
              {feedPlaces.map((p) => (
                <button key={p} className={`chip ${feedPlace === p ? 'on' : ''}`} onClick={() => setFeedPlace(feedPlace === p ? null : p)}>
                  {placeName(p, ui.lang)}
                </button>
              ))}
            </div>
          )}
          <div className="hscroll">
            {shownFeed.map((f) => (
              <Link key={f.share_id} className="post-card" href={`/app/v/${f.share_id}`} onClick={() => track('community_open')}>
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

      {trends && (trends.places.some((p) => p.placement && !/design|extract|minta/i.test(p.placement)) || popular.length > 0) && (
        <>
          <div className="section-title">
            <h2>{t('Trending this week', 'A hét kedvencei')}</h2>
            {trends.previews_total > 50 && <span className="small muted">{t(`${trends.previews_total} previews made`, `${trends.previews_total} előnézet készült`)}</span>}
          </div>
          {trends.places.length > 0 && (
            <div className="row" style={{ gap: 6, marginBottom: 10 }}>
              {trends.places.filter((p) => p.placement && !/design|extract|minta/i.test(p.placement)).slice(0, 8).map((p, i) => (
                <span key={p.placement} className="chip" style={{ whiteSpace: 'normal', maxWidth: '100%' }}>
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
        <span className="small muted">{t(`${shownDesigns.length} designs`, `${shownDesigns.length} minta`)}</span>
      </div>
      <div className="ex-dtools">
        <input className="text" type="search" placeholder={t('Search: moon, rose, wave…', 'Keresés: hold, rózsa, hullám…')} value={dq} onChange={(e) => setDq(e.target.value)} />
        <div className="chips">
          {(
            [
              ['all', t('All', 'Mind')],
              ['fine-line', 'Fine line'],
              ['blackwork', 'Blackwork'],
              ['traditional', t('Traditional', 'Tradicionális')],
              ['fav', `♥ ${t('My favorites', 'Kedvenceim')}${favs.length ? ` (${favs.length})` : ''}`],
            ] as const
          ).map(([k, l]) => (
            <button key={k} className={`chip ${dstyle === k ? 'on' : ''}`} onClick={() => setDstyle(k)}>
              {l}
            </button>
          ))}
        </div>
      </div>
      {shownDesigns.length === 0 ? (
        <p className="sub">{dstyle === 'fav' ? t('Tap the heart on a design to keep it here.', 'Koppints egy minta szívére, és itt találod meg.') : t('No design matches.', 'Nincs ilyen minta.')}</p>
      ) : (
        <div className="hscroll ex-designs">
          {shownDesigns.map((d) => (
            <div key={d.id} className="ex-design-wrap">
              <button className="ex-design" aria-label={t(`Try ${d.en}`, `${d.hu} kipróbálása`)} title={t(d.en, d.hu)} onClick={() => tryDesign(d.id)}>
                <img src={d.thumb || d.src} alt="" loading="lazy" onError={(e) => { const i = e.currentTarget; if (i.src !== d.src) i.src = d.src; }} />
              </button>
              <button className={`ex-fav ${favs.includes(d.id) ? 'on' : ''}`} aria-label={favs.includes(d.id) ? t('Remove from favorites', 'Kivétel a kedvencek közül') : t('Save to favorites', 'Kedvencekhez')} aria-pressed={favs.includes(d.id)} onClick={() => toggleFav(d.id)}>
                {Icon.heart}
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="section-title">
        <h2>{t('Knowledge base', 'Tudástár')}</h2>
        <Link className="small" href={`/app/tudastar${qOf(ui.lang)}`}>
          {t('All articles', 'Az összes cikk')} →
        </Link>
      </div>
      <div className="hscroll ex-articles">
        {ARTICLES.map((a) => (
          <Link key={a.slug} className="article-card" href={`/app/tudastar/${a.slug}${qOf(ui.lang)}`}>
            {KB[a.slug] && <img src={IMG(KB[a.slug].img, 600)} alt="" loading="lazy" />}
            <span className="tag">{pick(a.tag, ui.lang)}</span>
            <b>{pick(a.title, ui.lang)}</b>
            <span>{pick(a.desc, ui.lang)}</span>
          </Link>
        ))}
      </div>

      <QuickFacts lang={ui.lang} />
    </div>
  );
}
