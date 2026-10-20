'use client';
import { useApp } from '../AppProvider';
import { tx } from '@/lib/i18n';
import { Preview, StageKey } from '@/lib/store';
import { longevity } from '@/lib/score';
import { OTHER_SPOTS } from './constants';

/** "Make it last": redraw the design or try it bigger. */
export function FixCard({
  onImprove,
  improving,
  pending,
  suggestCm,
  onResize,
}: {
  onImprove?: () => void;
  improving: boolean;
  pending: StageKey[];
  suggestCm: number | null;
  onResize?: (cm: number) => void;
}) {
  const { ui } = useApp();
  const t = (en: string, hu: string) => tx(ui.lang, en, hu);
  return (
    <div className="card fixcard">
      <h2>{t('Make it last', 'Tedd tartóssá')}</h2>
      <p className="muted">
        {t(
          'We can redraw your design the way an experienced artist would — bolder key lines, fewer tiny details — and show you how that version ages.',
          'Átrajzoljuk a mintádat úgy, ahogy egy tapasztalt tetováló tenné – erősebb fő vonalak, kevesebb apró részlet –, és megmutatjuk, hogyan öregszik az a változat.'
        )}
      </p>
      <div className="stack">
        {onImprove && (
          <button className="btn wide" onClick={onImprove} disabled={improving || pending.length > 0}>
            {improving ? t('Redrawing your design…', 'A minta átrajzolása…') : t('Redraw it to last', 'Rajzold át tartósra')}
          </button>
        )}
        {suggestCm && onResize && (
          <button className="btn ghost wide" onClick={() => onResize(suggestCm)} disabled={pending.length > 0}>
            {t(`Try it at ${suggestCm} cm`, `Próbáld ki ${suggestCm} cm-esen`)}
          </button>
        )}
      </div>
    </div>
  );
}

/** The aging score: factors, the same design elsewhere, suggestions and tips. */
export function ScoreCard({
  preview,
  report,
  own,
  onTryPlace,
}: {
  preview: Preview;
  report: NonNullable<Preview['report']>;
  own: boolean;
  onTryPlace?: (placement: string) => void;
}) {
  const { ui } = useApp();
  const t = (en: string, hu: string) => tx(ui.lang, en, hu);
  const scoreColor = report ? (report.score >= 75 ? '#1f8a5b' : report.score >= 55 ? '#d68a1f' : 'var(--fresh)') : 'var(--violet)';
  return (
    <div className="card">
      <div className="score-head">
        <div className="score-ring" style={{ ['--v' as any]: report.score, ['--c' as any]: scoreColor }}>
          <span>{report.score}</span>
          <small>/100</small>
        </div>
        <div>
          <h2>{ui.t('result.score')}</h2>
          <p>
            {report.score >= 75
              ? t('This should age well.', 'Ez jól fog öregedni.')
              : report.score >= 55
                ? t('Good, with a few things to watch.', 'Jó, de van pár dolog, amire figyelj.')
                : t('Likely to blur or fade a lot.', 'Valószínűleg sokat mosódik vagy fakul.')}
          </p>
        </div>
      </div>
      <ul className="factors">
        {report.factors.slice(0, 5).map((f) => (
          <li key={f.label} className={f.impact < 0 ? 'neg' : 'pos'}>
            <b>{f.impact > 0 ? `+${f.impact}` : f.impact}</b> {f.label}
          </li>
        ))}
      </ul>
      {report.input && !own && (() => {
        const here = preview.placement.toLowerCase();
        const alts = OTHER_SPOTS.filter(([v]) => !here.includes(v.toLowerCase().split(' ').pop()!))
          .map(([v, en, hu]) => ({ v, en, hu, score: longevity({ ...report.input!, placement: v }, ui.lang).score }))
          .sort((a, b) => b.score - a.score)
          .slice(0, 5);
        return (
          <div className="elsewhere">
            <b>{t('The same design elsewhere', 'Ugyanez a minta máshol')}</b>
            {onTryPlace && <p className="small muted" style={{ margin: '2px 0 0' }}>{t('Tap a spot to see it there for real.', 'Koppints egy helyre, és megnézzük ott is, valódi képpel.')}</p>}
            <div>
              {alts.map((a) =>
                onTryPlace ? (
                  <button key={a.en} className={`elsebtn ${a.score > report.score ? 'up' : a.score < report.score ? 'down' : ''}`} onClick={() => onTryPlace(a.v)} title={t('Try it there with a photo of that spot', 'Próbáld ki ott – egy fotó kell arról a helyről')}>
                    {t(a.en, a.hu)} <b>{a.score}</b>
                  </button>
                ) : (
                  <span key={a.en} className={a.score > report.score ? 'up' : a.score < report.score ? 'down' : ''}>
                    {t(a.en, a.hu)} <b>{a.score}</b>
                  </span>
                )
              )}
            </div>
          </div>
        );
      })()}
      {report.suggestions.map((s) => (
        <div className="tipcard" key={s} style={{ marginBottom: 8 }}>
          <b>{t('Suggestion', 'Javaslat')}</b>
          <p>{s}</p>
        </div>
      ))}
      <h3 style={{ marginTop: 14 }}>{ui.t('result.tips')}</h3>
      <ul style={{ margin: 0, paddingLeft: 20, color: 'var(--ink-2)' }}>
        {report.tips.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
    </div>
  );
}
