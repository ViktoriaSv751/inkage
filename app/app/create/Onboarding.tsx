'use client';

import { useEffect, useState } from 'react';
import { useApp } from '../AppProvider';
import { tx } from '@/lib/i18n';
import { haptic, lsSet, track } from '@/lib/store';
import { sb } from '@/lib/sb';
import { BodyMap } from './BodyMap';

export type OnboardingAnswers = {
  adult: boolean;
  has: string;
  goal: string;
  placement: string;
  style: string;
  size: string;
  sun: 'low' | 'medium' | 'high';
  age: string;
  fear: string;
};

type Q = { key: keyof OnboardingAnswers; en: string; hu: string; options: { v: string; en: string; hu: string; emoji?: string }[] };

// Two questions, then straight to the photo. 18+ is asked by the age gate (and agreed at sign-up), size is set on the
// photo itself; style and sun keep their defaults (users quit the longer version before ever adding a photo).
const QUESTIONS: Q[] = [
  { key: 'goal', en: 'What would you like to see?', hu: 'Mit szeretnél megnézni?', options: [
    { v: 'new', en: 'A new tattoo idea', hu: 'Egy új tetoválás-ötletet' }, { v: 'existing', en: 'How my tattoo will age', hu: 'Hogyan öregszik a meglévő tetoválásom' },
    { v: 'removal', en: 'How laser removal would look', hu: 'Milyen lenne a lézeres eltávolítás' }, { v: 'explore', en: 'Just looking around', hu: 'Csak körülnézek' } ] },
  { key: 'placement', en: 'Where would it go?', hu: 'Hová kerülne?', options: [] },
];

export function Onboarding({ onDone }: { onDone: (a: OnboardingAnswers) => void }) {
  const { ui, me } = useApp();
  const L = (en: string, hu: string) => tx(ui.lang, en, hu);
  const [i, setI] = useState(0);
  const [a, setA] = useState<Partial<OnboardingAnswers>>({ adult: true, has: '', goal: '', size: '8', sun: 'medium', age: '', fear: '', style: 'other' });

  useEffect(() => track('onboarding_start'), []);

  const pick = (q: Q, v: string) => {
    haptic();
    const next = { ...a, [q.key]: v } as OnboardingAnswers;
    setA(next);
    // "just looking around": no more questions, the Explore page instead
    if (q.key === 'goal' && v === 'explore') return finish(next);
    if (i < QUESTIONS.length - 1) setTimeout(() => setI(i + 1), 160);
    else finish(next);
  };

  const finish = (ans = a as OnboardingAnswers) => {
    lsSet('ink_onboarding', ans);
    if (me.user) sb()?.rpc('save_profile', { p_onboarding: ans, p_lang: ui.lang })?.then(() => {}, () => {});
    track('onboarding_done', { goal: ans.goal, style: ans.style, placement: ans.placement });
    haptic('success');
    onDone(ans);
  };

  const q = QUESTIONS[i];
  const cur = a[q.key] as string | undefined;
  return (
    <div className="ob">
      <div className="ob-top">
        <button className="iconbtn" aria-label={ui.t('common.back')} disabled={i === 0} onClick={() => setI(i - 1)}>
          <svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" /></svg>
        </button>
        <div className="ob-progress" aria-label={`${i + 1} / ${QUESTIONS.length}`}>
          <i style={{ width: `${((i + 1) / QUESTIONS.length) * 100}%` }} />
        </div>
        <button className="link" onClick={() => finish()}>
          {L('Skip', 'Kihagyom')}
        </button>
      </div>
      <h1 className="ob-title" key={q.key}>
        {L(q.en, q.hu)}
      </h1>
      {q.key === 'placement' ? (
        <BodyMap value={a.placement || ''} onChange={(v) => pick(q, v)} />
      ) : (
      <div className={`ob-options ${q.options.length > 5 ? 'grid' : ''}`}>
        {q.options.map((o) => (
          <button key={o.v} className={`ob-opt ${cur === o.v ? 'on' : ''}`} onClick={() => pick(q, o.v)}>
            {o.emoji && <span className="em">{o.emoji}</span>}
            {L(o.en, o.hu)}
          </button>
        ))}
      </div>
      )}
    </div>
  );
}
