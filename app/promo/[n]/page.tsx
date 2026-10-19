/* Store marketing frames (App Store / Google Play screenshots and the Play feature graphic).
   Rendered at 430×932 (iPhone, ×3) or 405×720 (Play phone, ×2.667) by scripts/promo-shots.mjs. Not linked anywhere. */
import type { Metadata } from 'next';
import { LogoMark } from '../../LogoMark';
import './promo.css';

export const metadata: Metadata = { robots: { index: false, follow: false }, title: 'InkAge' };

const IMG = (id: string, w = 900) => `/img/${id}-${w}.webp`;
const P = {
  rose0: 'hf_20261013_200843_f699cd39-8d0a-43e3-9ba7-71b494279840',
  rose50: 'hf_20261013_200913_5ffd13b1-e537-4454-bb4c-495a2921afcc',
  swallow0: 'hf_20261013_200843_15e0b201-b6cc-486c-a5a4-9073748b837c',
  swallow50: 'hf_20261013_200918_3120c2be-e153-4881-a8f8-04c1cf79fcb4',
  sizes: 'hf_20261013_094428_03d5223f-83ed-4279-a522-78515046a4c0',
  phone: 'hf_20261013_090754_b336f404-4c34-4ef7-b5ba-a080d341d5db',
  friends: 'hf_20261013_090754_fed474a4-feac-40fa-928d-47ed6d6cef1a',
  sketch: 'hf_20261012_155954_fd830d0f-7102-4ef8-94d3-6f8b588ae649',
  fine: 'hf_20261013_090744_fa240786-23c2-4080-9014-5773a46c24d8',
  black: 'hf_20261013_090744_81012d7b-bcf7-48ff-b115-254ef696da03',
  color: 'hf_20261013_090754_c7e69247-a961-4a5f-98fc-f0e49bbc69ff',
  moonRuler: 'hf_20261013_200842_59e2ff0d-43b6-421c-8c81-067a029f3447',
  compass: 'hf_20261013_200843_bcf96b56-c709-495d-957a-2c52717a71f3',
  vine: 'hf_20261013_090712_871c7ded-ebc4-4b71-9793-726037d5c35e',
  sun0: 'hf_20261012_125250_eb1fedf5-fe1d-4bff-b203-9f7f6e04435f',
  sun50: 'hf_20261012_125519_356de094-5fd9-4c5d-a3d4-2e41892aa5b4',
};

type L = 'en' | 'hu';
const T = {
  en: {
    s1: ['Tattoo aging preview', 'See your tattoo', 'in 50 years', 'On your own photo, before it’s permanent.'],
    s2: ['Fresh vs. 50 years', 'Same tattoo.', 'Fifty years apart.', 'Drag the line and watch sun, skin and time.'],
    s3: ['Your photo, any design', 'Your skin.', 'Your light.', 'Snap the spot, pick a design or describe it.'],
    s4: ['Size & placement', 'Decide calmly,', 'not in the chair.', 'Real centimetres, three spots, one evening.'],
    s5: ['Ask your friends', 'Can’t decide?', 'Let them vote.', 'One link. Your friends pick, you decide.'],
    s6: ['Free · one tap', 'Try it now.', 'It’s free.', 'Sign in with Apple or Google, results in a minute.'],
    yearsLater: 'years later', now: 'Now', fresh: 'Fresh', y50: '50 years', score: 'Longevity score', scoreNote: 'Fine lines soften after ~10 years',
    create: 'New preview', step: 'Step 2 of 3', yourPhoto: 'Your photo', design: 'Pick a design', show: 'Show me my tattoo', styles: ['Fine line', 'Blackwork', 'Color', 'Sketch'],
    size: 'Size', place: 'Placement', spots: ['Inner forearm', 'Wrist', 'Shoulder'], fade: 'At 30 years',
    poll: 'Which one should I get?', votes: '14 votes', share: 'Share vote link', a: 'Fine-line moon', b: 'Compass',
    welcome: 'Welcome', signin: 'Sign in with Google or Apple to try InkAge on your own photo.', apple: 'Continue with Apple', google: 'Continue with Google', trust: ['Private account', 'No posting', 'Free'],
    tag: 'See any tattoo on your own photo – fresh and after 1, 10, 30 and 50 years.',
  },
  hu: {
    s1: ['Tetoválás-öregedés előnézet', 'Nézd meg a tetoválásod', '50 év múlva', 'A saját fotódon, mielőtt végleges lesz.'],
    s2: ['Friss vagy 50 éves', 'Ugyanaz a tetoválás.', 'Ötven év különbség.', 'Húzd a vonalat: nap, bőr és idő.'],
    s3: ['Saját fotó, bármilyen minta', 'A te bőröd.', 'A te fényeid.', 'Fotózd le a helyét, válassz mintát vagy írd le.'],
    s4: ['Méret és elhelyezés', 'Dönts nyugodtan,', 'ne a székben.', 'Valódi centiméter, három hely, egy este.'],
    s5: ['Kérdezd meg a barátaidat', 'Nem tudsz dönteni?', 'Szavazzanak.', 'Egy link: ők választanak, te döntesz.'],
    s6: ['Ingyenes · egy koppintás', 'Próbáld ki most.', 'Ingyenes.', 'Belépés Apple- vagy Google-fiókkal, egy perc az eredmény.'],
    yearsLater: 'év múlva', now: 'Most', fresh: 'Friss', y50: '50 év', score: 'Tartóssági pontszám', scoreNote: 'A vékony vonalak ~10 év után lágyulnak',
    create: 'Új előnézet', step: '2. lépés / 3', yourPhoto: 'A fotód', design: 'Válassz mintát', show: 'Mutasd a tetoválásom', styles: ['Fine line', 'Blackwork', 'Színes', 'Vázlat'],
    size: 'Méret', place: 'Elhelyezés', spots: ['Alkar belső', 'Csukló', 'Váll'], fade: '30 év múlva',
    poll: 'Melyiket csináltassam?', votes: '14 szavazat', share: 'Szavazó-link megosztása', a: 'Vékony vonalas hold', b: 'Iránytű',
    welcome: 'Üdv!', signin: 'Lépj be Google- vagy Apple-fiókkal, és próbáld ki a saját fotódon.', apple: 'Folytatás Apple-lel', google: 'Folytatás Google-lel', trust: ['Privát fiók', 'Nem posztolunk', 'Ingyenes'],
    tag: 'Nézd meg a tetoválásod a saját fotódon – frissen és 1, 10, 30, 50 év múlva.',
  },
};

function Phone({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <div className={`pr-phone ${dark ? 'dark' : ''}`}>
      <div className="pr-screen">
        <div className="pr-status">
          <b>9:41</b>
          <span className="pr-island" />
          <span className="pr-icons">
            <i />
            <i />
            <i />
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}

function Bar({ title, light = false }: { title?: string; light?: boolean }) {
  return (
    <div className={`pr-bar ${light ? 'light' : ''}`}>
      <span className="pr-brand">
        <LogoMark />
        InkAge
      </span>
      {title && <small>{title}</small>}
    </div>
  );
}

function Years({ at }: { at: number }) {
  const stops = [0, 1, 10, 30, 50];
  return (
    <div className="pr-years">
      <div className="pr-track">
        <div className="pr-fill" style={{ width: `${(stops.indexOf(at) / 4) * 100}%` }} />
        {stops.map((s, i) => (
          <span key={s} className={`pr-dot ${s <= at ? 'on' : ''}`} style={{ left: `${(i / 4) * 100}%` }} />
        ))}
      </div>
      <div className="pr-ticks">
        {stops.map((s) => (
          <span key={s}>{s}</span>
        ))}
      </div>
    </div>
  );
}

function Screen({ n, t }: { n: number; t: (typeof T)['en'] }) {
  if (n === 1)
    return (
      <Phone dark>
        <div className="pr-hero" style={{ backgroundImage: `url(${IMG(P.sun50, 1400)})` }}>
          <Bar light />
          <div className="pr-big">
            <b>50</b>
            <span>{t.yearsLater}</span>
          </div>
          <Years at={50} />
        </div>
        <div className="pr-sheet">
          <div className="pr-score">
            <div>
              <small>{t.score}</small>
              <b>
                82<i>/100</i>
              </b>
            </div>
            <div className="pr-ring">
              <span style={{ ['--p' as string]: '82%' }} />
            </div>
          </div>
          <p>{t.scoreNote}</p>
        </div>
      </Phone>
    );
  if (n === 2)
    return (
      <Phone>
        <Bar title={t.fresh + ' · ' + t.y50} />
        <div className="pr-split">
          <img src={IMG(P.rose0, 1400)} alt="" />
          <div className="pr-half">
            <img src={IMG(P.rose50, 1400)} alt="" />
          </div>
          <span className="pr-line" />
          <span className="pr-knob">‹ ›</span>
          <em className="l">{t.fresh}</em>
          <em className="r">{t.y50}</em>
        </div>
        <Years at={50} />
      </Phone>
    );
  if (n === 3)
    return (
      <Phone>
        <Bar title={t.step} />
        <div className="pr-pad">
          <h4>{t.yourPhoto}</h4>
          <div className="pr-photo" style={{ backgroundImage: `url(${IMG(P.phone)})` }} />
          <h4>{t.design}</h4>
          <div className="pr-grid">
            {[P.fine, P.black, P.color, P.sketch].map((id, i) => (
              <div key={id} className={`pr-tile ${i === 0 ? 'on' : ''}`}>
                <img src={IMG(id, 480)} alt="" />
                <small>{t.styles[i]}</small>
              </div>
            ))}
          </div>
          <div className="pr-btn">{t.show}</div>
        </div>
      </Phone>
    );
  if (n === 4)
    return (
      <Phone>
        <Bar title={t.size + ' · ' + t.place} />
        <div className="pr-pad">
          <div className="pr-photo tall" style={{ backgroundImage: `url(${IMG(P.sizes, 1400)})` }} />
          <div className="pr-chips">
            {['3 cm', '5 cm', '8 cm', '12 cm'].map((c, i) => (
              <span key={c} className={i === 1 ? 'on' : ''}>
                {c}
              </span>
            ))}
          </div>
          <div className="pr-list">
            {t.spots.map((s, i) => (
              <div key={s} className={i === 0 ? 'on' : ''}>
                <span>{s}</span>
                <b>{[86, 71, 78][i]}</b>
              </div>
            ))}
          </div>
        </div>
      </Phone>
    );
  if (n === 5)
    return (
      <Phone>
        <Bar title={t.votes} />
        <div className="pr-pad">
          <h3 className="pr-q">{t.poll}</h3>
          <div className="pr-vote">
            {[
              [P.moonRuler, t.a, 64],
              [P.compass, t.b, 36],
            ].map(([id, name, pct], i) => (
              <div key={String(id)} className={`pr-opt ${i === 0 ? 'win' : ''}`}>
                <img src={IMG(String(id), 480)} alt="" />
                <div className="pr-opt-t">
                  <span>{String(name)}</span>
                  <b>{pct}%</b>
                </div>
                <div className="pr-meter">
                  <i style={{ width: `${pct}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="pr-btn">{t.share}</div>
        </div>
      </Phone>
    );
  return (
    <Phone dark>
      <div className="pr-hero short" style={{ backgroundImage: `url(${IMG(P.sun0, 1400)})` }}>
        <Bar light />
        <div className="pr-big">
          <b>25</b>
          <span>{t.yearsLater}</span>
        </div>
        <Years at={10} />
      </div>
      <div className="pr-sheet tall">
        <h3>{t.welcome}</h3>
        <p>{t.signin}</p>
        <div className="pr-auth white"> {t.apple}</div>
        <div className="pr-auth">
          <b className="g">G</b> {t.google}
        </div>
        <div className="pr-trust">
          {t.trust.map((x) => (
            <span key={x}>✓ {x}</span>
          ))}
        </div>
      </div>
    </Phone>
  );
}

function Float({ n, t }: { n: number; t: (typeof T)['en'] }) {
  if (n === 1)
    return (
      <div className="pr-float f1">
        <img src={IMG(P.sun0, 480)} alt="" />
        <span>{t.fresh}</span>
      </div>
    );
  if (n === 4)
    return (
      <div className="pr-float f4">
        <div className="pr-pair">
          <img src={IMG(P.swallow0, 480)} alt="" />
          <img src={IMG(P.swallow50, 480)} alt="" />
        </div>
        <span>{t.fade}</span>
      </div>
    );
  if (n === 5)
    return (
      <div className="pr-float f5">
        <img src={IMG(P.friends, 480)} alt="" />
      </div>
    );
  return null;
}

export default async function Promo({ params, searchParams }: { params: Promise<{ n: string }> | { n: string }; searchParams: Promise<Record<string, string>> | Record<string, string> }) {
  const { n } = await params;
  const sp = await searchParams;
  const lang: L = sp.lang === 'hu' ? 'hu' : 'en';
  const t = T[lang];
  if (n === 'feature')
    return (
      <main className="pr-feature" lang={lang}>
        <div className="pr-f-txt">
          <div className="pr-f-logo">
            <span className="pr-f-icon">
              <LogoMark />
            </span>
            InkAge
          </div>
          <h1>
            {t.s1[1]} <em>{t.s1[2]}</em>
          </h1>
          <p>{t.tag}</p>
        </div>
        <div className="pr-f-pics">
          <figure>
            <img src={IMG(P.rose0, 900)} alt="" />
            <figcaption>{t.fresh}</figcaption>
          </figure>
          <figure>
            <img src={IMG(P.rose50, 900)} alt="" />
            <figcaption>{t.y50}</figcaption>
          </figure>
        </div>
      </main>
    );
  const k = Math.min(6, Math.max(1, Number(n) || 1));
  const s = t[`s${k}` as 's1'];
  return (
    <main className={`pr s${k}`} lang={lang}>
      <div className="pr-glow" />
      <header className="pr-head">
        <small>{s[0]}</small>
        <h1>
          {s[1]}
          <br />
          <em>{s[2]}</em>
        </h1>
        <p>{s[3]}</p>
      </header>
      <div className="pr-stage">
        <Screen n={k} t={t} />
        <Float n={k} t={t} />
      </div>
    </main>
  );
}
