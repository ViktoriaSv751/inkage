'use client';

import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../AppProvider';
import { tx } from '@/lib/i18n';
import { haptic, lsSet, track } from '@/lib/store';
import { longevity } from '@/lib/score';
import { sb } from '@/lib/sb';

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

const QUESTIONS: Q[] = [
  { key: 'adult', en: 'Are you 18 or older?', hu: 'Elmúltál 18 éves?', options: [{ v: 'yes', en: 'Yes, I’m 18+', hu: 'Igen, elmúltam 18' }, { v: 'no', en: 'No', hu: 'Nem' }] },
  { key: 'has', en: 'Do you have any tattoos?', hu: 'Van már tetoválásod?', options: [
    { v: 'none', en: 'Not yet', hu: 'Még nincs', emoji: '✨' }, { v: 'one', en: 'One', hu: 'Egy', emoji: '☝️' }, { v: 'several', en: 'A few', hu: 'Több is', emoji: '🖋️' } ] },
  { key: 'goal', en: 'What are you planning?', hu: 'Mit tervezel?', options: [
    { v: 'first', en: 'My first tattoo', hu: 'Az első tetoválásom', emoji: '🌱' }, { v: 'another', en: 'Another one', hu: 'Egy újabbat', emoji: '➕' },
    { v: 'cover', en: 'A cover-up', hu: 'Takarást', emoji: '🩹' }, { v: 'curious', en: 'Just curious', hu: 'Csak kíváncsi vagyok', emoji: '👀' } ] },
  { key: 'placement', en: 'Where would it go?', hu: 'Hová kerülne?', options: [
    { v: 'Inner forearm', en: 'Forearm', hu: 'Alkar' }, { v: 'Wrist', en: 'Wrist', hu: 'Csukló' }, { v: 'Hand', en: 'Hand', hu: 'Kézfej' },
    { v: 'Upper arm', en: 'Upper arm', hu: 'Felkar' }, { v: 'Shoulder', en: 'Shoulder', hu: 'Váll' }, { v: 'Upper back', en: 'Back', hu: 'Hát' },
    { v: 'Ribs', en: 'Ribs', hu: 'Borda' }, { v: 'Thigh', en: 'Thigh', hu: 'Comb' }, { v: 'Ankle', en: 'Ankle', hu: 'Boka' }, { v: 'Back of neck', en: 'Neck', hu: 'Nyak' } ] },
  { key: 'style', en: 'Which style are you drawn to?', hu: 'Melyik stílus vonz?', options: [
    { v: 'fine-line', en: 'Fine line', hu: 'Fine line (vékony vonal)' }, { v: 'blackwork', en: 'Bold blackwork', hu: 'Vastag blackwork' },
    { v: 'color', en: 'Color', hu: 'Színes' }, { v: 'realism', en: 'Realism', hu: 'Realista' }, { v: 'other', en: 'Not sure yet', hu: 'Még nem tudom' } ] },
  { key: 'size', en: 'How big?', hu: 'Mekkora legyen?', options: [
    { v: '3', en: 'Tiny (under 4 cm)', hu: 'Pici (4 cm alatt)' }, { v: '6', en: 'Small (4–7 cm)', hu: 'Kicsi (4–7 cm)' },
    { v: '10', en: 'Medium (7–12 cm)', hu: 'Közepes (7–12 cm)' }, { v: '16', en: 'Large (12 cm+)', hu: 'Nagy (12 cm felett)' } ] },
  { key: 'sun', en: 'How much sun does that spot get?', hu: 'Mennyi nap éri azt a részt?', options: [
    { v: 'low', en: 'Rarely', hu: 'Ritkán', emoji: '🌥️' }, { v: 'medium', en: 'Sometimes', hu: 'Néha', emoji: '⛅' }, { v: 'high', en: 'Often', hu: 'Gyakran', emoji: '☀️' } ] },
  { key: 'age', en: 'How old are you?', hu: 'Hány éves vagy?', options: [
    { v: '21', en: '18–24', hu: '18–24' }, { v: '30', en: '25–34', hu: '25–34' }, { v: '40', en: '35–44', hu: '35–44' }, { v: '50', en: '45–54', hu: '45–54' }, { v: '60', en: '55+', hu: '55+' } ] },
  { key: 'fear', en: 'What worries you most?', hu: 'Mi aggaszt a legjobban?', options: [
    { v: 'blur', en: 'Lines blurring', hu: 'Hogy elmosódnak a vonalak', emoji: '🌫️' }, { v: 'fade', en: 'Fading', hu: 'Hogy kifakul', emoji: '🎨' },
    { v: 'regret', en: 'Regretting it', hu: 'Hogy megbánom', emoji: '😬' }, { v: 'aging', en: 'How it looks when I’m older', hu: 'Hogy néz ki, ha idősebb leszek', emoji: '⏳' } ] },
];

export function Onboarding({ onDone }: { onDone: (a: OnboardingAnswers) => void }) {
  const { ui, me } = useApp();
  const L = (en: string, hu: string) => tx(ui.lang, en, hu);
  const [i, setI] = useState(0);
  const [a, setA] = useState<Partial<OnboardingAnswers>>({});
  const [phase, setPhase] = useState<'q' | 'building' | 'plan' | 'blocked'>('q');

  useEffect(() => track('onboarding_start'), []);

  const pick = (q: Q, v: string) => {
    haptic();
    const val: any = q.key === 'adult' ? v === 'yes' : v;
    const next = { ...a, [q.key]: val };
    setA(next);
    if (q.key === 'adult' && v === 'no') return setPhase('blocked');
    if (i < QUESTIONS.length - 1) setTimeout(() => setI(i + 1), 160);
    else {
      setPhase('building');
      setTimeout(() => setPhase('plan'), 2400);
    }
  };

  const plan = useMemo(() => {
    if (phase !== 'plan') return null;
    return longevity(
      {
        style: (a.style as any) || 'other',
        hasColor: a.style === 'color',
        sun: (a.sun as any) || 'medium',
        placement: a.placement || '',
        sizeCm: Number(a.size) || null,
        detail: a.style === 'fine-line' ? 0.7 : 0.45,
        age: Number(a.age) || null,
      },
      ui.lang
    );
  }, [phase, a, ui.lang]);

  const finish = () => {
    const ans = a as OnboardingAnswers;
    lsSet('ink_onboarding', ans);
    if (me.user) sb()?.rpc('save_profile', { p_onboarding: ans, p_lang: ui.lang });
    track('onboarding_done', { goal: ans.goal, style: ans.style, placement: ans.placement });
    haptic('success');
    onDone(ans);
  };

  if (phase === 'blocked')
    return (
      <div className="ob center">
        <h1 className="ob-title">{L('InkAge is for adults', 'Az InkAge felnőtteknek szól')}</h1>
        <p className="sub">{L('You need to be 18 or older to use InkAge.', 'Az InkAge használatához legalább 18 évesnek kell lenned.')}</p>
      </div>
    );

  if (phase === 'building')
    return (
      <div className="ob center">
        <div className="build-ring" />
        <h1 className="ob-title">{L('Building your tattoo plan…', 'Összeállítjuk a tetoválás-terved…')}</h1>
        <ul className="build-steps">
          <li>{L('Matching your style and size', 'Stílus és méret egyeztetése')}</li>
          <li>{L('Checking your placement', 'A testrész vizsgálata')}</li>
          <li>{L('Estimating how it will age', 'Az öregedés becslése')}</li>
        </ul>
      </div>
    );

  if (phase === 'plan' && plan)
    return (
      <div className="ob obplan">
        <p className="kicker">{L('Your tattoo plan', 'A tetoválás-terved')}</p>
        <h1 className="ob-title">{L('Here’s how your idea is likely to age', 'Így fog nagy valószínűséggel öregedni az ötleted')}</h1>
        <div className="score-ring big" style={{ ['--v' as any]: plan.score }}>
          <span>{plan.score}</span>
          <small>/100</small>
        </div>
        <p className="center sub">{L('Estimated ink longevity — before we even see your photo.', 'Becsült tartóssági pontszám – még a fotód nélkül.')}</p>
        <ul className="factors">
          {plan.factors.slice(0, 3).map((f) => (
            <li key={f.label} className={f.impact < 0 ? 'neg' : 'pos'}>
              <b>{f.impact > 0 ? `+${f.impact}` : f.impact}</b> {f.label}
            </li>
          ))}
        </ul>
        <div className="tipcard">
          <b>{L('Our tip', 'Javaslatunk')}</b>
          <p>{plan.suggestions[0]}</p>
        </div>
        <button className="btn wide" onClick={finish}>
          {L('See it on my own photo', 'Nézzük a saját fotómon')}
        </button>
      </div>
    );

  const q = QUESTIONS[i];
  const cur = q.key === 'adult' ? (a.adult === undefined ? undefined : a.adult ? 'yes' : 'no') : (a[q.key] as string | undefined);
  return (
    <div className="ob">
      <div className="ob-top">
        <button className="iconbtn" aria-label={ui.t('common.back')} disabled={i === 0} onClick={() => setI(i - 1)}>
          <svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" /></svg>
        </button>
        <div className="ob-progress" aria-label={`${i + 1} / ${QUESTIONS.length}`}>
          <i style={{ width: `${((i + 1) / QUESTIONS.length) * 100}%` }} />
        </div>
      </div>
      <h1 className="ob-title" key={q.key}>
        {L(q.en, q.hu)}
      </h1>
      <div className={`ob-options ${q.options.length > 5 ? 'grid' : ''}`}>
        {q.options.map((o) => (
          <button key={o.v} className={`ob-opt ${cur === o.v ? 'on' : ''}`} onClick={() => pick(q, o.v)}>
            {o.emoji && <span className="em">{o.emoji}</span>}
            {L(o.en, o.hu)}
          </button>
        ))}
      </div>
    </div>
  );
}
