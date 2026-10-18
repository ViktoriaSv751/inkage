'use client';
import { qOf } from '@/lib/tr';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { sb } from '@/lib/sb';
import { anonId, lsGet, lsSet, track } from '@/lib/store';
import { useLang, tx } from '@/lib/i18n';
import type { Share } from './SharedView';
import { Report } from './Report';

/** inApp: opened from Explore inside the app (no site logo, the call to action stays in the app) */
export function Vote({ id, initial, inApp = false }: { id: string; initial: Share; inApp?: boolean }) {
  const { lang } = useLang();
  const t = (en: string, hu: string) => tx(lang, en, hu);
  const [s, setS] = useState(initial);
  const [mine, setMine] = useState<string | null>(null);
  const [show50, setShow50] = useState(false);

  useEffect(() => {
    setMine(lsGet<string | null>(`ink_vote_${id}`, null));
    track('share_view', { id });
    const tm = setTimeout(() => setShow50(true), 1600);
    return () => clearTimeout(tm);
  }, [id]);

  const vote = async (choice: 'yes' | 'no' | 'change') => {
    setMine(choice);
    lsSet(`ink_vote_${id}`, choice);
    const { data } = (await sb()?.rpc('cast_vote', { p_share: id, p_choice: choice, p_voter: anonId() })) || {};
    if (data) {
      setS(data as Share);
      fetch('/api/vote-notify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ share: id }) }).catch(() => {});
    }
    track('vote', { choice });
  };

  const total = s.votes.yes + s.votes.no + s.votes.change || 1;
  const pct = (n: number) => Math.round((n / total) * 100);
  const opts: [('yes' | 'no' | 'change'), string, string][] = [
    ['yes', t('Get it! 🔥', 'Csináltasd! 🔥'), '#4b2bd6'],
    ['change', t('Change something ✏️', 'Változtass rajta ✏️'), '#d68a1f'],
    ['no', t('Don’t do it 😬', 'Ne csináld 😬'), '#e0483b'],
  ];

  // A/B: two versions, "which one?" ('yes' = A, 'no' = B)
  if (s.paths.y50B) {
    const ab: ['yes' | 'no', string, string | undefined, string | undefined][] = [
      ['yes', s.labels?.a || 'A', s.paths.fresh, s.paths.y50],
      ['no', s.labels?.b || 'B', s.paths.freshB, s.paths.y50B],
    ];
    const tot = s.votes.yes + s.votes.no || 1;
    return (
      <main style={{ maxWidth: 720, margin: '0 auto', padding: '20px 16px 60px', position: 'relative', zIndex: 1 }}>
        {!inApp && (
        <Link href="/" className="logo" style={{ fontSize: 26 }}>
          InkAge
        </Link>
      )}
        <h1 style={{ fontSize: 'clamp(40px, 10vw, 60px)', margin: '14px 0 6px' }}>{t('Which one should I get?', 'Melyiket csináltassam?')}</h1>
        <p className="sub" style={{ margin: '0 0 14px' }}>{show50 ? t('Both after 50 years.', 'Mindkettő 50 év múlva.') : t('Both fresh.', 'Mindkettő frissen.')}</p>
        <div className="flip" style={{ marginBottom: 12 }}>
          <button className={!show50 ? 'on' : ''} onClick={() => setShow50(false)}>
            {t('Fresh', 'Friss')}
          </button>
          <button className={show50 ? 'on' : ''} onClick={() => setShow50(true)}>
            {t('50 years', '50 év')}
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {ab.map(([k, label, fresh, old]) => (
            <button key={k} onClick={() => vote(k)} style={{ border: mine === k ? '3px solid var(--stencil)' : '3px solid transparent', borderRadius: 22, padding: 0, overflow: 'hidden', background: '#000', position: 'relative', textAlign: 'left' }}>
              <img src={show50 ? old : fresh} alt={label} style={{ display: 'block', width: '100%', aspectRatio: '4/5', objectFit: 'cover' }} />
              <span style={{ position: 'absolute', left: 10, top: 10, background: '#fff', color: '#000', borderRadius: 99, padding: '4px 12px', fontWeight: 800 }}>{label}</span>
              {mine && (
                <span style={{ position: 'absolute', right: 10, bottom: 10, background: 'rgba(0,0,0,.7)', color: '#fff', borderRadius: 99, padding: '4px 12px', fontWeight: 800 }}>
                  {Math.round((s.votes[k] / tot) * 100)}%
                </span>
              )}
            </button>
          ))}
        </div>
        <p className="fine">{mine ? t(`${tot} vote${tot === 1 ? '' : 's'} so far`, `Eddig ${tot} szavazat`) : t('Tap the one you like more.', 'Koppints arra, amelyik jobban tetszik.')}</p>
        <div style={{ background: 'var(--ink)', color: '#fff', borderRadius: 24, padding: 22, marginTop: 24 }}>
          <h2 style={{ fontSize: 30, lineHeight: 1, margin: '0 0 8px' }}>{t('See your own tattoo in 50 years', 'Nézd meg a saját tetoválásod 50 év múlva')}</h2>
          <p style={{ color: 'rgba(255,255,255,.8)', margin: '0 0 16px' }}>{inApp ? t('Upload a photo, add a design, see it fresh and in 50 years.', 'Tölts fel egy fotót, adj hozzá mintát, és nézd meg frissen és 50 év múlva.') : t('Free after a one-tap sign-up with Google or Apple.', 'Egy koppintásos Google- vagy Apple-regisztráció után ingyenes.')}</p>
          <Link className="btn wide light" href={inApp ? '/app' : `/regisztracio${qOf(lang)}`} onClick={() => track('share_cta')}>
            {inApp ? t('Make my own', 'Elkészítem a sajátomat') : t('Register and try it', 'Regisztrálok és kipróbálom')}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 520, margin: '0 auto', padding: '20px 16px 60px', position: 'relative', zIndex: 1 }}>
      {!inApp && (
      <Link href="/" className="logo" style={{ fontSize: 26 }}>
        InkAge
      </Link>
    )}
      <h1 style={{ fontSize: 'clamp(44px, 12vw, 64px)', margin: '14px 0 14px' }}>{t('Should I get this?', 'Csináltassam meg?')}</h1>
      <div className="photo-stack" style={{ maxHeight: 'none', borderRadius: 24 }}>
        {s.paths.fresh && <img src={s.paths.fresh} alt={t('The tattoo, fresh', 'A tetoválás frissen')} />}
        {s.paths.y50 && <img src={s.paths.y50} alt={t('The tattoo after 50 years', 'A tetoválás 50 év múlva')} style={{ opacity: show50 ? 1 : 0, transition: 'opacity 1.2s' }} />}
        <div className="year-readout">
          <span className="year-num">{show50 ? '50' : t('NEW', 'ÚJ')}</span>
          <span className="year-unit">{show50 ? t('years later', 'év múlva') : t('fresh ink', 'friss tinta')}</span>
        </div>
        {s.score !== null && <span className="real-tag">{t('Longevity', 'Tartósság')} {s.score}/100</span>}
      </div>
      <div className="flip" style={{ marginTop: 12 }}>
        <button className={!show50 ? 'on' : ''} onClick={() => setShow50(false)}>
          {t('Fresh', 'Friss')}
        </button>
        <button className={show50 ? 'on' : ''} onClick={() => setShow50(true)}>
          {t('50 years', '50 év')}
        </button>
      </div>

      <div style={{ display: 'grid', gap: 10, marginTop: 20 }}>
        {opts.map(([k, label, col]) => (
          <button
            key={k}
            onClick={() => vote(k)}
            style={{
              position: 'relative',
              overflow: 'hidden',
              border: mine === k ? `2px solid ${col}` : '2px solid transparent',
              background: '#fff6f0',
              borderRadius: 18,
              padding: '16px 18px',
              textAlign: 'left',
              fontWeight: 700,
              fontSize: 17,
            }}
          >
            {mine && <span style={{ position: 'absolute', inset: 0, width: `${pct(s.votes[k])}%`, background: col, opacity: 0.15, transition: 'width .5s' }} />}
            <span style={{ position: 'relative', display: 'flex', justifyContent: 'space-between' }}>
              {label}
              {mine && <span>{pct(s.votes[k])}%</span>}
            </span>
          </button>
        ))}
      </div>
      {mine && <p className="fine">{t(`${total} vote${total === 1 ? '' : 's'} so far`, `Eddig ${total} szavazat`)}</p>}

      <div style={{ background: 'var(--ink)', color: '#fff', borderRadius: 24, padding: 22, marginTop: 28 }}>
        <h2 style={{ fontFamily: 'var(--display)', textTransform: 'uppercase', fontSize: 34, lineHeight: 0.95, margin: '0 0 8px' }}>
          {t('See your own tattoo in 50 years', 'Nézd meg a saját tetoválásod 50 év múlva')}
        </h2>
        <p style={{ color: 'rgba(255,255,255,.8)', margin: '0 0 16px' }}>{inApp ? t('Upload a photo, add a design, see it fresh and in 50 years.', 'Tölts fel egy fotót, adj hozzá mintát, és nézd meg frissen és 50 év múlva.') : t('Free after a one-tap sign-up with Google or Apple.', 'Egy koppintásos Google- vagy Apple-regisztráció után ingyenes.')}</p>
        <Link className="btn wide" href={inApp ? '/app' : `/regisztracio${qOf(lang)}`} onClick={() => track('share_cta')}>
          {inApp ? t('Make my own', 'Elkészítem a sajátomat') : t('Register and try it', 'Regisztrálok és kipróbálom')}
        </Link>
      </div>
      <p className="fine">{t('AI simulation for inspiration.', 'MI-szimuláció inspirációnak.')}</p>
      <Report id={id} lang={lang} />
    </main>
  );
}
