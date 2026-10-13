'use client';

import { useEffect, useRef, useState } from 'react';
import { useApp } from '../AppProvider';
import { tx } from '@/lib/i18n';
import { haptic } from '@/lib/store';
import { isCustom, makeCustom, nearest, parseCustom, PLACEMENTS } from '@/lib/placements';

function Figure({ view }: { view: 'front' | 'back' }) {
  // One arm and one leg are drawn and mirrored, so the figure stays symmetric.
  const arm =
    'M58 80 C47 84 44 96 43 110 L39 158 C38 170 35 186 33 198 L30 212 C28 220 26 228 25 238 C24 247 26 254 31 254 C35 253 36 246 37 238 L39 214 C41 204 44 192 46 180 L52 136 C53 126 55 112 57 100 Z';
  const leg = 'M63 206 L99 206 L98 232 C96 270 94 300 93 330 L91 400 C91 412 93 421 97 428 L77 430 C78 420 79 410 78 398 L72 330 C66 296 60 262 63 206 Z';
  return (
    <g className="bm-figure">
      <ellipse className="bm-floor" cx="100" cy="434" rx="44" ry="5" />
      <path d={leg} />
      <path d={leg} transform="translate(200 0) scale(-1 1)" />
      <path d={arm} />
      <path d={arm} transform="translate(200 0) scale(-1 1)" />
      <path d="M93 50 L107 50 L109 70 L91 70 Z" />
      <path d="M70 74 C84 68 116 68 130 74 C141 78 146 88 145 104 C144 128 138 146 134 166 C132 180 134 194 138 210 L62 210 C66 194 68 180 66 166 C62 146 56 128 55 104 C54 88 59 78 70 74 Z" />
      <ellipse className="bm-head" cx="100" cy="34" rx="15" ry="19" />
      {view === 'back' ? <path className="bm-detail" d="M100 76 L100 196" /> : <path className="bm-detail" d="M78 84 C88 88 94 86 100 84 C106 86 112 88 122 84" />}
    </g>
  );
}

export function BodyMap({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { ui } = useApp();
  const t = (en: string, hu: string) => tx(ui.lang, en, hu);
  const custom = parseCustom(value);
  const sel = PLACEMENTS.findIndex((p) => p.v === value);
  const [view, setView] = useState<'front' | 'back'>(custom?.view || PLACEMENTS[sel]?.view || 'front');
  const [free, setFree] = useState(isCustom(value));
  const [label, setLabel] = useState(custom?.label || '');
  const svg = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const v = parseCustom(value)?.view || PLACEMENTS.find((p) => p.v === value)?.view;
    if (v) setView(v);
    if (isCustom(value)) setLabel(parseCustom(value)!.label);
  }, [value]);

  const pick = (v: string) => {
    setFree(false);
    onChange(v);
    haptic();
  };

  // custom mode: tap anywhere on the figure to drop a pin
  const drop = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!free || !svg.current) return;
    const pt = svg.current.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(svg.current.getScreenCTM()!.inverse());
    const x = Math.max(10, Math.min(190, p.x)), y = Math.max(10, Math.min(436, p.y));
    const n = nearest(view, x, y);
    const auto = t(`near the ${n.en.toLowerCase()}`, `a(z) ${n.hu.toLowerCase()} közelében`);
    // keep a label the user typed; otherwise describe the spot by its nearest area
    const keep = custom && label && !/közelében$|^near the /.test(label) ? label : auto;
    setLabel(keep);
    onChange(makeCustom({ view, x, y, label: keep }));
    haptic();
  };

  const listed = PLACEMENTS.map((p, i) => ({ ...p, n: i + 1 })).filter((p) => p.view === view);

  return (
    <div className="bodymap2">
      <div className="bm-stage">
        <div className="flip bm-flip" role="radiogroup" aria-label={t('Side', 'Nézet')}>
          <button role="radio" aria-checked={view === 'front'} className={view === 'front' ? 'on' : ''} onClick={() => setView('front')}>
            {t('Front', 'Elöl')}
          </button>
          <button role="radio" aria-checked={view === 'back'} className={view === 'back' ? 'on' : ''} onClick={() => setView('back')}>
            {t('Back', 'Hátul')}
          </button>
        </div>
        <svg ref={svg} viewBox="0 0 200 440" className={`bm-svg ${free ? 'free' : ''}`} role="group" aria-label={t('Body map', 'Testtérkép')} onPointerUp={drop}>
          <Figure view={view} />
          {!free &&
            listed.map((p) => {
              const on = p.v === value;
              return (
                <g
                  key={p.v}
                  className={`bm-spot ${on ? 'on' : ''}`}
                  role="radio"
                  aria-checked={on}
                  aria-label={`${p.n}. ${t(p.en, p.hu)}`}
                  tabIndex={0}
                  onClick={() => pick(p.v)}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && pick(p.v)}
                >
                  <circle className="bm-hit" cx={p.x} cy={p.y} r="15" />
                  {on && <circle className="bm-halo" cx={p.x} cy={p.y} r="15.5" />}
                  <circle cx={p.x} cy={p.y} r="10.5" />
                  <text x={p.x} y={p.y + 3.6}>{p.n}</text>
                </g>
              );
            })}
          {custom && custom.view === view && (
            <g className="bm-pin">
              <circle className="bm-halo" cx={custom.x} cy={custom.y} r="14" />
              <circle cx={custom.x} cy={custom.y} r="8" />
              <circle className="bm-pin-dot" cx={custom.x} cy={custom.y} r="2.6" />
            </g>
          )}
        </svg>
        <button
          className={`chipbtn bm-free ${free ? 'on' : ''}`}
          onClick={() => {
            setFree(!free);
            haptic();
          }}
          aria-pressed={free}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 21s-6-5.6-6-11a6 6 0 1 1 12 0c0 5.4-6 11-6 11z" />
            <circle cx="12" cy="10" r="2.2" />
          </svg>
          {free ? t('Tap the body to mark a spot', 'Koppints a testre') : t('Custom spot', 'Számozáson kívüli hely')}
        </button>
      </div>

      <div className="bm-side">
        {free || custom ? (
          <div className="bm-custom">
            <b>{t('Your own spot', 'Saját hely')}</b>
            <p className="muted small">
              {custom
                ? t('Fine-tune it in your own words — the AI follows them.', 'Pontosítsd a saját szavaiddal – az MI ez alapján helyezi el.')
                : t('Tap anywhere on the figure, on any part of the body.', 'Koppints bárhová az alakon, bármelyik testrészre.')}
            </p>
            {custom && (
              <textarea
                className="notes"
                rows={3}
                maxLength={90}
                value={label}
                aria-label={t('Describe the spot', 'A hely leírása')}
                placeholder={t('e.g. left side of the stomach, below the ribs', 'pl. a has bal oldala, a borda alatt')}
                onChange={(e) => {
                  setLabel(e.target.value);
                  onChange(makeCustom({ ...custom, label: e.target.value || custom.label }));
                }}
              />
            )}
            <button
              className="link"
              onClick={() => {
                setFree(false);
                pick(nearest(custom?.view || view, custom?.x || 100, custom?.y || 120).v);
              }}
            >
              {t('Back to numbered spots', 'Vissza a számozott helyekhez')}
            </button>
          </div>
        ) : (
          <ol className="bm-legend">
            {listed.map((p) => (
              <li key={p.v}>
                <button className={p.v === value ? 'on' : ''} onClick={() => pick(p.v)} aria-pressed={p.v === value}>
                  <span>{p.n}</span>
                  {t(p.en, p.hu)}
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
