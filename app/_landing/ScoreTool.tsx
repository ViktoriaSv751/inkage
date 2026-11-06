'use client';

import { useRef, useState } from 'react';
import { longevity, type ScoreInput } from '@/lib/score';
import { SEO_AREAS, SEO_STYLES } from '@/lib/seo';
import { pick, type Lang } from '@/lib/tr';
import { track } from '@/lib/track';
import { TryLink } from '../AuthCta';
import type { T } from './types';

/**
 * "How long will it last?" without a photo or an account: style, body area, size and sun → the same 0–100
 * longevity score the app gives, with the reasons. The button takes the choices into the app.
 */
const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);

export function ScoreTool({ t, lang, where }: { t: T; lang: Lang; where: string }) {
  const [style, setStyle] = useState<(typeof SEO_STYLES)[number]['k']>('fine-line');
  const [area, setArea] = useState<(typeof SEO_AREAS)[number]['k']>('forearm');
  const [cm, setCm] = useState(8);
  const [sun, setSun] = useState<'low' | 'medium' | 'high'>('medium');
  const used = useRef(false);
  const s = SEO_STYLES.find((x) => x.k === style)!;
  const a = SEO_AREAS.find((x) => x.k === area)!;
  const input: ScoreInput = { style: s.style, hasColor: s.style === 'color' || s.style === 'realism', sun, placement: a.v, sizeCm: cm, detail: s.detail, age: 28 };
  const r = longevity(input, lang);
  const score = Math.max(0, Math.min(100, Math.round(r.score)));
  const tone = score >= 75 ? 'good' : score >= 55 ? 'ok' : 'low';
  const touch = () => {
    if (used.current) return;
    used.current = true;
    track('score_tool_used', { where });
  };
  const verdict =
    score >= 75 ? t('Usually ages well.', 'Általában jól öregszik.') : score >= 55 ? t('A good choice, with a few things to watch.', 'Jó választás, néhány dologra figyelni kell.') : t('Likely to blur or fade noticeably.', 'Valószínűleg észrevehetően elmosódik vagy fakul.');
  return (
    <section className="ls-sec sct">
      <div className="ls-head">
        <h2>{t('How long will your tattoo last?', 'Meddig marad szép a tetoválásod?')}</h2>
        <p className="lm-sub">{t('Pick a style, a spot and a size. No photo, no account.', 'Válassz stílust, helyet és méretet. Fotó és fiók nélkül.')}</p>
      </div>
      <div className="sct-box">
        <div className="sct-form" onChange={touch}>
          <label>
            {t('Style', 'Stílus')}
            <select value={style} onChange={(e) => setStyle(e.target.value as any)}>
              {SEO_STYLES.map((x) => (
                <option key={x.k} value={x.k}>
                  {pick(x, lang)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('Body area', 'Testrész')}
            <select value={area} onChange={(e) => setArea(e.target.value as any)}>
              {SEO_AREAS.map((x) => (
                <option key={x.k} value={x.k}>
                  {cap(pick(x, lang))}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('Size', 'Méret')}: <b>{cm} cm</b>
            <input type="range" min={2} max={20} value={cm} onChange={(e) => setCm(Number(e.target.value))} />
          </label>
          <label>
            {t('Sun on that spot', 'Napfény azon a helyen')}
            <select value={sun} onChange={(e) => setSun(e.target.value as any)}>
              <option value="low">{t('Rarely', 'Ritkán')}</option>
              <option value="medium">{t('Sometimes', 'Néha')}</option>
              <option value="high">{t('Often', 'Gyakran')}</option>
            </select>
          </label>
        </div>
        <div className="sct-out" aria-live="polite">
          <div className={`sct-score ${tone}`}>
            <b>{score}</b>
            <span>/ 100</span>
          </div>
          <p className="sct-verdict">{verdict}</p>
          <ul className="sct-why">
            {r.factors.slice(0, 3).map((f) => (
              <li key={f.label} className={f.impact < 0 ? 'neg' : 'pos'}>
                {f.label}
              </li>
            ))}
          </ul>
          <TryLink lang={lang} className="btn" to={`/app?place=${encodeURIComponent(a.v)}&style=${s.style}`} onClick={() => track('score_tool_try', { where })}>
            {t('See it on my own skin', 'Megnézem a saját bőrömön')}
          </TryLink>
          <p className="sct-note">{t('An estimate from how ink, skin and sun usually behave.', 'Becslés abból, ahogy a tinta, a bőr és a nap általában viselkedik.')}</p>
        </div>
      </div>
    </section>
  );
}
