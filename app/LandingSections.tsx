'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ARTICLES } from '@/lib/articles';
import { IMG, KB } from '@/lib/kb';
import { SEO_AREAS, SEO_STYLES, seoPage } from '@/lib/seo';
import { track } from '@/lib/store';
import { EXAMPLE } from './visuals';
import { AgingTimeline, BetaInstall, CompareSlider, CompareTable, LandingFaq, Precision, PrivacyBlock, TrustStrip, UseCases } from './LandingMore';
import './landing2.css';

const P = {
  phone: 'hf_20261013_090754_b336f404-4c34-4ef7-b5ba-a080d341d5db',
  friends: 'hf_20261013_090754_fed474a4-feac-40fa-928d-47ed6d6cef1a',
  laser: 'hf_20261013_090723_c91c49fb-f918-4ca5-a1d9-383c4f6a6a31',
  flatlay: 'hf_20261013_090637_ca312303-c618-4a41-946b-8b783b5b3cee',
  studio: 'hf_20261013_090802_c2968625-4757-4c65-8bfd-d6c8e7ff7d3a',
  rose: 'hf_20261012_155954_fd830d0f-7102-4ef8-94d3-6f8b588ae649',
};
const STYLE_IMG: Record<string, string> = {
  'fine-line': 'hf_20261013_090744_fa240786-23c2-4080-9014-5773a46c24d8',
  blackwork: 'hf_20261013_090744_81012d7b-bcf7-48ff-b115-254ef696da03',
  traditional: 'hf_20261013_090744_160850a7-0937-4436-8c96-929449d5e6f2',
  color: 'hf_20261013_090754_c7e69247-a961-4a5f-98fc-f0e49bbc69ff',
  realism: 'hf_20261013_090754_884850ef-3a8a-4f13-9702-e5afbd3729d0',
};

export function LandingSections({ lang, made, onUpload }: { lang: 'en' | 'hu'; made: number; onUpload: () => void }) {
  const t = (en: string, hu: string) => (lang === 'hu' ? hu : en);
  const kbSfx = lang === 'hu' ? '' : '?lang=en';
  const seoSfx = lang === 'en' ? '?lang=en' : '';
  const [style, setStyle] = useState<(typeof SEO_STYLES)[number]['k']>('fine-line');
  const st = SEO_STYLES.find((s) => s.k === style)!;
  const ranked = SEO_AREAS.map((a) => ({ a, score: seoPage(`${style}-${a.k}`, lang)?.medium ?? 0 })).sort((x, y) => y.score - x.score);
  const featured = ['how-tattoos-age', 'fine-line-tattoos-aging', 'best-placement-for-tattoo-longevity', 'tattoo-size-guide'].map((s) => ARTICLES.find((a) => a.slug === s)!).filter(Boolean);

  const steps = [
    {
      img: <img src={IMG(P.phone, 700)} alt="" loading="lazy" />,
      h: t('Your photo', 'A fotód'),
      p: t('Snap the spot where the tattoo will go. We check light and focus, and find the bare skin.', 'Fotózd le a helyet, ahová a tetoválás kerül. Ellenőrizzük a fényt, az élességet, és megkeressük a csupasz bőrt.'),
    },
    {
      img: (
        <div className="ls-design">
          <img src={IMG(P.rose, 500)} alt="" loading="lazy" />
          <span>Pinterest</span>
          <span>{t('Screenshot', 'Képernyőfotó')}</span>
          <span>{t('Sketch', 'Vázlat')}</span>
        </div>
      ),
      h: t('Any design', 'Bármilyen minta'),
      p: t('From a photo of someone else’s arm we cut out only the tattoo — no person, no clothes, no background.', 'Akár más karjáról készült fotóból is csak magát a tetoválást vágjuk ki – ember, ruha és háttér nélkül.'),
    },
    {
      img: (
        <div className="ls-place">
          <img src={EXAMPLE[0].src} alt="" loading="lazy" />
          <i className="ls-frame" />
          <span className="ls-cm">≈ 6 cm</span>
        </div>
      ),
      h: t('Place it', 'Helyezd el'),
      p: t('Drag, pinch and rotate it into place, with the real size in centimetres. It only ever goes on skin.', 'Húzd, méretezd, forgasd a helyére, valós centiméterrel. Csak bőrre kerülhet, ruhára soha.'),
    },
    {
      img: (
        <div className="ls-aged">
          <img src={EXAMPLE[4].src} alt="" loading="lazy" />
          <b>50</b>
          <small>{t('years later', 'év múlva')}</small>
        </div>
      ),
      h: t('Watch it age', 'Nézd, hogyan öregszik'),
      p: t('Realistic images on your own skin at 1, 10, 30 and 50 years, with a longevity score and tips.', 'Valósághű képek a saját bőrödön 1, 10, 30 és 50 év múlva, tartóssági pontszámmal és tippekkel.'),
    },
    {
      img: <img src={IMG(P.friends, 700)} alt="" loading="lazy" />,
      h: t('Ask your friends', 'Kérdezd meg a barátaidat'),
      p: t('A TikTok-ready video, or a link where friends vote: “get it”, “change it” or “which one?”.', 'TikTokra kész videó, vagy link, amin a barátaid szavaznak: „csináltasd”, „változtass” vagy „melyiket?”.'),
    },
  ];

  return (
    <>
      <TrustStrip t={t} />
      <CompareSlider t={t} />
      {/* ---------------------------------------------------------------- how it works */}
      <section className="ls-sec">
        <div className="ls-head">
          <p className="ls-kick">{t('How it works', 'Hogyan működik?')}</p>
          <h2>{t('From photo to 50 years, in about a minute.', 'A fotótól az 50 évig, nagyjából egy perc alatt.')}</h2>
        </div>
        <ol className="ls-steps">
          {steps.map((s, i) => (
            <li key={i} className="ls-step">
              <div className="ls-step-img">{s.img}</div>
              <span className="ls-num">{String(i + 1).padStart(2, '0')}</span>
              <h3>{s.h}</h3>
              <p>{s.p}</p>
            </li>
          ))}
        </ol>
      </section>

      <UseCases t={t} />

      {/* ---------------------------------------------------------------- everything for the decision */}
      <section className="ls-dark">
        <div className="ls-dark-in">
          <div className="ls-head">
            <p className="ls-kick light">{t('More than a picture', 'Több mint egy kép')}</p>
            <h2>{t('Everything you need to decide.', 'Minden, ami a döntéshez kell.')}</h2>
          </div>
          <div className="ls-bento">
            <div className="ls-tile score">
              <div className="ls-ring" style={{ ['--v' as any]: 78 }}>
                <b>78</b>
                <small>/100</small>
              </div>
              <h3>{t('Ink longevity score', 'Tartóssági pontszám')}</h3>
              <ul>
                <li className="up">+4 {t('Bold black lines last longest', 'A vastag fekete vonal tart a legtovább')}</li>
                <li className="down">−8 {t('Very fine detail for this size', 'Nagyon apró részletek ehhez a mérethez')}</li>
                <li className="up">+3 {t('Upper arm ages gently', 'A felkar szépen öregszik')}</li>
              </ul>
            </div>
            <div className="ls-tile pic">
              <img src={IMG(P.laser, 900)} alt="" loading="lazy" />
              <div>
                <h3>{t('What if you regret it?', 'Mi van, ha megbánod?')}</h3>
                <p>{t('A laser removal preview after 3, 6 and 10 sessions.', 'Lézeres eltávolítás előnézete 3, 6 és 10 kezelés után.')}</p>
              </div>
            </div>
            <div className="ls-tile pic">
              <img src={IMG(P.flatlay, 900)} alt="" loading="lazy" />
              <div>
                <h3>{t('A PDF for your artist', 'PDF a tetoválódnak')}</h3>
                <p>{t('Design, size, placement and previews on one page.', 'Minta, méret, hely és előnézetek egy oldalon.')}</p>
              </div>
            </div>
            <div className="ls-tile pic">
              <img src={IMG(P.friends, 900)} alt="" loading="lazy" />
              <div>
                <h3>{t('Videos and vote links', 'Videó és szavazós link')}</h3>
                <p>{t('Five ready templates for TikTok, Reels and Shorts.', 'Öt kész sablon TikTokra, Reelsre és Shortsra.')}</p>
              </div>
            </div>
            <div className="ls-tile redraw">
              <div className="ls-redraw">
                <img src={IMG(STYLE_IMG['fine-line'], 500)} alt="" loading="lazy" />
                <span aria-hidden="true">→</span>
                <img src={IMG(STYLE_IMG.blackwork, 500)} alt="" loading="lazy" />
              </div>
              <h3>{t('Make it last', 'Tedd tartóssá')}</h3>
              <p>{t('We redraw a fragile design the way an experienced artist would — and show how that version ages.', 'Egy sérülékeny mintát úgy rajzolunk át, ahogy egy tapasztalt tetováló tenné – és megmutatjuk, hogy öregszik az a változat.')}</p>
            </div>
          </div>
        </div>
      </section>

      <AgingTimeline t={t} />
      <Precision t={t} />

      {/* ---------------------------------------------------------------- know before you ink */}
      <section className="ls-sec">
        <div className="ls-head row-between">
          <div>
            <p className="ls-kick">{t('Knowledge base', 'Tudástár')}</p>
            <h2>{t('Know before you ink.', 'Tudd, mielőtt varratsz.')}</h2>
          </div>
          <Link className="ls-link" href={`/tudastar${kbSfx}`} onClick={() => track('landing_kb')}>
            {t(`All ${ARTICLES.length} articles`, `Mind a ${ARTICLES.length} cikk`)} <span aria-hidden="true">→</span>
          </Link>
        </div>
        <div className="ls-mag">
          {featured.map((a, i) => (
            <Link key={a.slug} href={`/tudastar/${a.slug}${kbSfx}`} className={`ls-art ${i === 0 ? 'big' : ''}`}>
              <img src={IMG(KB[a.slug].img, i === 0 ? 1400 : 700)} alt="" loading="lazy" />
              <div>
                <span className="ls-tag">{a.tag[lang]}</span>
                <b>{a.title[lang]}</b>
                {i === 0 && <p>{a.desc[lang]}</p>}
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------------- styles × body areas */}
      <section className="ls-sec ls-styles">
        <div className="ls-head">
          <p className="ls-kick">{t('Styles × body areas', 'Stílusok × testrészek')}</p>
          <h2>{t('How each style ages, wherever you put it.', 'Hogyan öregszik egy stílus, attól függően, hová kerül.')}</h2>
        </div>
        <div className="ls-style-tabs" role="tablist">
          {SEO_STYLES.map((s) => (
            <button key={s.k} role="tab" aria-selected={style === s.k} className={style === s.k ? 'on' : ''} onClick={() => setStyle(s.k)}>
              <img src={IMG(STYLE_IMG[s.k], 200)} alt="" />
              {lang === 'hu' ? s.hu.replace(/ \(.*\)/, '') : s.en}
            </button>
          ))}
        </div>
        <div className="ls-style-body">
          <figure className="ls-style-pic">
            <img src={IMG(STYLE_IMG[style], 900)} alt="" />
            <figcaption>
              <b>{lang === 'hu' ? st.hu : st.en}</b>
              <span>{t('Score at 8 cm, average sun', 'Pontszám 8 cm-en, átlagos napfény mellett')}</span>
            </figcaption>
          </figure>
          <ol className="ls-bars">
            {ranked.map(({ a, score }) => (
              <li key={a.k}>
                <Link href={`/tattoo/${style}-${a.k}${seoSfx}`}>
                  <span className="ls-bar-name">{lang === 'hu' ? a.hu : a.en}</span>
                  <span className="ls-bar">
                    <i style={{ width: `${score}%`, background: score >= 75 ? 'var(--green)' : score >= 55 ? 'var(--amber)' : 'var(--red)' }} />
                  </span>
                  <b>{score}</b>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <CompareTable t={t} />
      <PrivacyBlock t={t} />
      <BetaInstall t={t} />
      <LandingFaq t={t} kbSfx={kbSfx} />

      {/* ---------------------------------------------------------------- final call */}
      <section className="ls-final">
        <img src={IMG(P.studio, 1800)} alt="" loading="lazy" />
        <div className="ls-final-in">
          <h2>{t('See it before it’s permanent.', 'Nézd meg, mielőtt végleges lesz.')}</h2>
          <p>
            {made >= 100
              ? t(`${made.toLocaleString('en')} previews made so far. Free while in beta, no sign-up.`, `Eddig ${made.toLocaleString('hu')} előnézet készült. A tesztidőszakban ingyenes, regisztráció nélkül.`)
              : t('Free while in beta. No sign-up for your first preview.', 'A tesztidőszakban ingyenes. Az első előnézethez nem kell regisztrálni.')}
          </p>
          <div className="ls-final-btns">
            <button className="btn" onClick={onUpload}>
              {t('Upload my photo', 'Feltöltöm a fotómat')}
            </button>
            <Link className="btn ghost" href="/app">
              {t('Open the app', 'App megnyitása')}
            </Link>
          </div>
        </div>
      </section>

    </>
  );
}
