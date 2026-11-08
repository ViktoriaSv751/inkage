'use client';
import { useState } from 'react';

export type PainZone = { id: string; name: string; note: string; lvl: 0 | 1 | 2 };
export type PainText = { title: string; hint: string; front: string; back: string; levels: [string, string, string]; zones: PainZone[] };

/* shapes per zone id (front figure at x 0–200, back figure at x 220–420; both 0–440 tall) */
const S: Record<string, JSX.Element[]> = {
  'outer-upper-arm': [<ellipse key="a" cx="38" cy="125" rx="13" ry="30" />, <ellipse key="b" cx="162" cy="125" rx="13" ry="30" />],
  'inner-upper-arm': [<ellipse key="a" cx="52" cy="128" rx="6" ry="24" />, <ellipse key="b" cx="148" cy="128" rx="6" ry="24" />],
  armpit: [<ellipse key="a" cx="58" cy="98" rx="7" ry="9" />, <ellipse key="b" cx="142" cy="98" rx="7" ry="9" />],
  elbow: [<circle key="a" cx="36" cy="164" r="9" />, <circle key="b" cx="164" cy="164" r="9" />],
  forearm: [<ellipse key="a" cx="31" cy="200" rx="10" ry="26" />, <ellipse key="b" cx="169" cy="200" rx="10" ry="26" />],
  hand: [<ellipse key="a" cx="26" cy="246" rx="10" ry="16" />, <ellipse key="b" cx="174" cy="246" rx="10" ry="16" />],
  chest: [<ellipse key="a" cx="82" cy="105" rx="18" ry="14" />, <ellipse key="b" cx="118" cy="105" rx="18" ry="14" />],
  sternum: [<rect key="a" x="95" y="92" width="10" height="44" rx="5" />],
  ribs: [<ellipse key="a" cx="70" cy="150" rx="9" ry="22" />, <ellipse key="b" cx="130" cy="150" rx="9" ry="22" />],
  stomach: [<ellipse key="a" cx="100" cy="170" rx="22" ry="24" />],
  'outer-thigh': [<ellipse key="a" cx="70" cy="262" rx="12" ry="36" />, <ellipse key="b" cx="130" cy="262" rx="12" ry="36" />],
  'inner-thigh': [<ellipse key="a" cx="90" cy="262" rx="7" ry="30" />, <ellipse key="b" cx="110" cy="262" rx="7" ry="30" />],
  knee: [<circle key="a" cx="78" cy="314" r="10" />, <circle key="b" cx="122" cy="314" r="10" />],
  shin: [<rect key="a" x="72" y="330" width="10" height="56" rx="5" />, <rect key="b" x="118" y="330" width="10" height="56" rx="5" />],
  foot: [<ellipse key="a" cx="76" cy="414" rx="12" ry="9" />, <ellipse key="b" cx="124" cy="414" rx="12" ry="9" />],
  'neck-back': [<rect key="a" x="310" y="58" width="20" height="20" rx="6" />],
  'upper-back': [<ellipse key="a" cx="298" cy="112" rx="20" ry="22" />, <ellipse key="b" cx="342" cy="112" rx="20" ry="22" />],
  spine: [<rect key="a" x="315" y="84" width="10" height="110" rx="5" />],
  buttocks: [<ellipse key="a" cx="304" cy="222" rx="18" ry="18" />, <ellipse key="b" cx="336" cy="222" rx="18" ry="18" />],
  calf: [<ellipse key="a" cx="298" cy="350" rx="11" ry="30" />, <ellipse key="b" cx="342" cy="350" rx="11" ry="30" />],
};

/* simple silhouettes: head, torso, arms, legs */
function Body({ dx }: { dx: number }) {
  return (
    <g transform={`translate(${dx} 0)`} className="pm-body">
      <circle cx="100" cy="34" r="22" />
      <rect x="90" y="54" width="20" height="18" rx="6" />
      <path d="M58 76 Q100 64 142 76 L150 205 Q100 222 50 205 Z" />
      <path d="M58 78 L30 100 L18 250 L34 254 L50 150 Z" />
      <path d="M142 78 L170 100 L182 250 L166 254 L150 150 Z" />
      <path d="M54 205 L98 212 L92 420 L62 420 Z" />
      <path d="M146 205 L102 212 L108 420 L138 420 Z" />
    </g>
  );
}

export function PainMap({ t }: { t: PainText }) {
  const [sel, setSel] = useState<string>('ribs');
  const z = t.zones.find((x) => x.id === sel);
  return (
    <figure className="pm">
      <figcaption className="pm-h">
        <b>{t.title}</b>
        <span>{t.hint}</span>
      </figcaption>
      <div className="pm-wrap">
        <svg viewBox="0 0 420 440" role="group" aria-label={t.title}>
          <Body dx={0} />
          <Body dx={220} />
          <text x="100" y="438" textAnchor="middle" className="pm-lab">{t.front}</text>
          <text x="320" y="438" textAnchor="middle" className="pm-lab">{t.back}</text>
          {t.zones.map((x) => (
            <g
              key={x.id}
              className={`pm-z pm-l${x.lvl} ${sel === x.id ? 'on' : ''}`}
              role="button"
              tabIndex={0}
              aria-label={`${x.name}: ${t.levels[x.lvl]}`}
              onClick={() => setSel(x.id)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setSel(x.id)}
            >
              {S[x.id]}
            </g>
          ))}
        </svg>
        <div className="pm-info" aria-live="polite">
          <ul className="pm-legend">
            {t.levels.map((l, i) => (
              <li key={i}>
                <i className={`pm-l${i}`} />
                {l}
              </li>
            ))}
          </ul>
          {z && (
            <div className={`pm-card pm-c${z.lvl}`}>
              <b>{z.name}</b>
              <span>{t.levels[z.lvl]}</span>
              <p>{z.note}</p>
            </div>
          )}
        </div>
      </div>
    </figure>
  );
}
