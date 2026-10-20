'use client';
import { useApp } from '../../AppProvider';
import { tx } from '@/lib/i18n';
import type { OnboardingAnswers } from '../../create/Onboarding';

/** The Skin & lifestyle tab: sun and age, used for every new preview. */
export function SkinCard({ ob, saveOb }: { ob: OnboardingAnswers | null; saveOb: (patch: Partial<OnboardingAnswers>) => void }) {
  const { ui } = useApp();
  const t = (en: string, hu: string) => tx(ui.lang, en, hu);
  return (
    <div className="card" style={{ marginTop: 12 }}>
      <h2>{t('Skin & lifestyle', 'Bőr és életmód')}</h2>
      <p className="muted small">{t('Sun is the #1 reason ink fades. This makes every aging preview match your life.', 'A nap a fakulás első számú oka. Ez alapján igazítjuk az öregedést a te életedhez.')}</p>
      <b style={{ display: 'block', fontSize: 14, margin: '10px 0 6px' }}>{t('How much sun does your skin get?', 'Mennyi nap éri a bőröd?')}</b>
      <div className="seg" role="radiogroup">
        {(
          [
            ['low', t('Little', 'Kevés')],
            ['medium', t('Some', 'Közepes')],
            ['high', t('A lot', 'Sok')],
          ] as const
        ).map(([v, l]) => (
          <button key={v} role="radio" aria-checked={(ob?.sun || 'medium') === v} className={(ob?.sun || 'medium') === v ? 'on' : ''} onClick={() => saveOb({ sun: v })}>
            {l}
          </button>
        ))}
      </div>
      <b style={{ display: 'block', fontSize: 14, margin: '14px 0 6px' }}>{t('Your age (makes the 30 and 50-year images more accurate)', 'Életkorod (pontosabb lesz a 30 és 50 éves kép)')}</b>
      <div className="row" style={{ gap: 6 }}>
        {['18-24', '25-34', '35-44', '45-54', '55+'].map((v) => (
          <button key={v} className={`chip ${ob?.age === v ? 'on' : ''}`} onClick={() => saveOb({ age: ob?.age === v ? '' : v })}>
            {v}
          </button>
        ))}
      </div>
      <button
        className="list-row"
        style={{ marginTop: 8 }}
        onClick={() => {
          location.href = '/app?again=1';
        }}
      >
        <span>
          {t('Answer the starting questions again', 'A kezdő kérdések újra')}
          <small>{t('Body area, size, style and goals', 'Testrész, méret, stílus és célok')}</small>
        </span>
        <span aria-hidden="true">›</span>
      </button>
    </div>
  );
}
