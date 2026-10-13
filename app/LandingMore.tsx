'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { IMG } from '@/lib/kb';
import { track } from '@/lib/store';
import { EXAMPLE } from './visuals';

type T = (en: string, hu: string) => string;

/* ------------------------------------------------------------------ facts strip under the hero */
export function TrustStrip({ t }: { t: T }) {
  const items = [
    { b: '5', s: t('moments: fresh, 1, 10, 30, 50 years', 'időpont: friss, 1, 10, 30, 50 év') },
    { b: '19', s: t('body areas on the body map', 'testrész a testtérképen') },
    { b: '0–100', s: t('longevity score with reasons', 'tartóssági pontszám, indoklással') },
    { b: '~1', s: t('minute from photo to preview', 'perc a fotótól az előnézetig') },
    { b: '0 Ft', s: t('free for everyone during the beta', 'mindenkinek ingyenes a béta alatt') },
  ];
  return (
    <ul className="lm-strip" aria-label={t('InkAge in numbers', 'Az InkAge számokban')}>
      {items.map((x) => (
        <li key={x.s}>
          <b>{x.b}</b>
          <span>{x.s}</span>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ drag to compare fresh vs 50 years */
export function CompareSlider({ t }: { t: T }) {
  const [v, setV] = useState(50);
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef(false);
  const moved = useRef(false);
  const at = (x: number) => {
    const r = box.current!.getBoundingClientRect();
    setV(Math.min(100, Math.max(0, ((x - r.left) / r.width) * 100)));
    if (!moved.current) {
      moved.current = true;
      track('landing_compare');
    }
  };
  return (
    <section className="lm-compare">
      <div className="lm-compare-head">
        <h2>{t('Same tattoo. Fifty years apart.', 'Ugyanaz a tetoválás. Ötven év különbséggel.')}</h2>
        <p>{t('Drag the line. Left is the day it was done, right is half a century of sun, skin and time — on the same arm.', 'Húzd a vonalat. Balra az elkészülés napja, jobbra fél évszázad nap, bőr és idő – ugyanazon a karon.')}</p>
      </div>
      <div
        className="lm-cmp"
        ref={box}
        onPointerDown={(e) => {
          drag.current = true;
          (e.target as Element).setPointerCapture?.(e.pointerId);
          at(e.clientX);
        }}
        onPointerMove={(e) => drag.current && at(e.clientX)}
        onPointerUp={() => (drag.current = false)}
        onPointerCancel={() => (drag.current = false)}
      >
        <img src={EXAMPLE[4].src} alt={t('The tattoo after 50 years', 'A tetoválás 50 év múlva')} draggable={false} loading="lazy" />
        <div className="lm-cmp-top" style={{ clipPath: `inset(0 ${100 - v}% 0 0)` }}>
          <img src={EXAMPLE[0].src} alt={t('The tattoo on day one', 'A tetoválás az első napon')} draggable={false} loading="lazy" />
        </div>
        <span className="lm-cmp-lab l">{t('Fresh', 'Friss')}</span>
        <span className="lm-cmp-lab r">{t('50 years', '50 év')}</span>
        <div className="lm-cmp-line" style={{ left: `${v}%` }}>
          <span
            role="slider"
            tabIndex={0}
            aria-label={t('Compare fresh and 50 years', 'Friss és 50 éves összehasonlítás')}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(v)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft') setV((x) => Math.max(0, x - 5));
              if (e.key === 'ArrowRight') setV((x) => Math.min(100, x + 5));
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 6l-6 6 6 6M15 6l6 6-6 6" />
            </svg>
          </span>
        </div>
      </div>
      <p className="lm-note">{t('Example made with InkAge. Previews are AI estimates, not a guarantee.', 'InkAge-dzsel készült példa. Az előnézetek MI-becslések, nem garanciák.')}</p>
    </section>
  );
}

/* ------------------------------------------------------------------ who it's for */
export function UseCases({ t }: { t: T }) {
  const cases = [
    {
      k: 'first',
      tab: t('My first tattoo', 'Az első tetoválásom'),
      img: 'hf_20261013_090637_ca312303-c618-4a41-946b-8b783b5b3cee',
      h: t('Decide calmly, not in the chair.', 'Dönts nyugodtan, ne a széken ülve.'),
      p: t('Try three placements and four sizes on your own photo in an evening. See which one still reads at 30 years, then book with confidence.', 'Egy este alatt kipróbálhatsz három helyet és négy méretet a saját fotódon. Nézd meg, melyik olvasható még 30 év múlva is, és utána foglalj nyugodtan.'),
      pts: [t('Placement and size in real centimetres', 'Hely és méret valós centiméterben'), t('A longevity score that explains itself', 'Tartóssági pontszám, ami meg is indokolja magát'), t('A link so friends can vote', 'Link, amin a barátaid szavazhatnak')],
    },
    {
      k: 'have',
      tab: t('I already have one', 'Már van tetoválásom'),
      img: 'hf_20261013_090713_9a5ab662-392f-41d6-9e0b-52da1e87bfe3',
      h: t('See where your ink is heading.', 'Nézd meg, merre tart a tintád.'),
      p: t('Upload a photo of a tattoo you already have. InkAge cuts it out, and shows how it is likely to look in 10, 30 and 50 years — and when a touch-up would help.', 'Tölts fel egy fotót egy meglévő tetoválásodról. Az InkAge kivágja, és megmutatja, hogyan nézhet ki 10, 30 és 50 év múlva – és mikor segítene egy frissítés.'),
      pts: [t('Smart cut-out from any photo', 'Okos kivágás bármilyen fotóból'), t('Sun and placement taken into account', 'A napfényt és a helyet is figyelembe veszi'), t('Tips to keep it crisp', 'Tippek, hogy éles maradjon')],
    },
    {
      k: 'remove',
      tab: t('Thinking about removal', 'Az eltávolításon gondolkodom'),
      img: 'hf_20261013_090723_c91c49fb-f918-4ca5-a1d9-383c4f6a6a31',
      h: t('Know what removal looks like.', 'Tudd, hogyan néz ki az eltávolítás.'),
      p: t('A laser removal preview after 3, 6 and 10 sessions helps you set realistic expectations — before you talk to a clinic.', 'A 3, 6 és 10 kezelés utáni lézeres előnézet segít reális elvárásokat kialakítani – még mielőtt klinikával beszélnél.'),
      pts: [t('Preview after 3, 6 and 10 sessions', 'Előnézet 3, 6 és 10 kezelés után'), t('Our guide to what to expect', 'Útmutató arról, mire számíts'), t('Always talk to a dermatologist', 'Mindig beszélj bőrgyógyásszal is')],
    },
    {
      k: 'artist',
      tab: t('I’m a tattoo artist', 'Tetováló vagyok'),
      img: 'hf_20261013_094348_fa04678b-2125-4f55-9708-311bbe98a9e9',
      h: t('Show clients why bolder lasts.', 'Mutasd meg a vendégnek, miért tart tovább az erősebb vonal.'),
      p: t('Instead of explaining line spacing, show it: the client’s design on the client’s arm at 30 years, next to your sturdier version.', 'Ahelyett, hogy a vonaltávolságot magyaráznád, mutasd meg: a vendég mintája a vendég karján 30 év múlva, a te tartósabb változatod mellett.'),
      pts: [t('“Make it last” redraw to compare', '„Tedd tartóssá” átrajzolás összehasonlításhoz'), t('One-page PDF with size and placement', 'Egyoldalas PDF mérettel és hellyel'), t('Works on phones, no install needed', 'Telefonon is működik, telepítés nélkül')],
    },
  ];
  const [k, setK] = useState(cases[0].k);
  const c = cases.find((x) => x.k === k)!;
  return (
    <section className="ls-sec lm-uses">
      <div className="ls-head">
        <h2>{t('Made for every kind of tattoo decision.', 'Minden tetoválásos döntéshez.')}</h2>
      </div>
      <div className="lm-tabs" role="tablist">
        {cases.map((x) => (
          <button key={x.k} role="tab" aria-selected={x.k === k} className={x.k === k ? 'on' : ''} onClick={() => (setK(x.k), track('landing_usecase', { k: x.k }))}>
            {x.tab}
          </button>
        ))}
      </div>
      <div className="lm-use" role="tabpanel">
        <div className="lm-use-img">
          <img key={c.img} src={IMG(c.img, 1200)} alt="" loading="lazy" />
        </div>
        <div className="lm-use-txt">
          <h3>{c.h}</h3>
          <p>{c.p}</p>
          <ul>
            {c.pts.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <Link className="btn" href="/app" onClick={() => track('landing_usecase_cta', { k })}>
            {t('Try it on my photo', 'Kipróbálom a fotómon')}
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ what happens at each moment */
export function AgingTimeline({ t }: { t: T }) {
  const stops = [
    { y: t('Day 1', '1. nap'), img: EXAMPLE[0].src, h: t('Fresh', 'Friss'), p: t('Sharp, dark and slightly raised. This is the version most photos show — and the one that lasts the shortest.', 'Éles, sötét és kicsit kiemelkedő. A legtöbb fotó ezt mutatja – és ez tart a legrövidebb ideig.') },
    { y: t('1 year', '1 év'), img: EXAMPLE[1].src, h: t('Healed', 'Gyógyult'), p: t('The top layer of skin has renewed. Lines look a touch softer and lighter than on day one.', 'A bőr felső rétege megújult. A vonalak kicsit lágyabbnak és világosabbnak tűnnek, mint az első napon.') },
    { y: t('10 years', '10 év'), img: EXAMPLE[2].src, h: t('Settled', 'Beállt'), p: t('Fine details start to soften; light colours fade first, especially where the sun reaches.', 'A finom részletek lágyulni kezdenek; a világos színek fakulnak először, főleg ahol éri a nap.') },
    { y: t('30 years', '30 év'), img: EXAMPLE[3].src, h: t('Mature', 'Érett'), p: t('Lines closer than about 1 mm may have merged. Bold, spaced designs still read clearly.', 'A kb. 1 mm-nél közelebbi vonalak összefolyhattak. A vastag, levegős minták még jól olvashatók.') },
    { y: t('50 years', '50 év'), img: EXAMPLE[4].src, h: t('A lifetime', 'Egy élet'), p: t('Skin itself has aged and carries the ink with it. Strong outlines are what keep the shape.', 'Maga a bőr is öregedett, és viszi magával a tintát. Az erős kontúr az, ami megtartja a formát.') },
  ];
  return (
    <section className="ls-sec lm-time">
      <div className="ls-head">
        <h2>{t('What changes, and when.', 'Mi változik, és mikor.')}</h2>
        <p className="lm-sub">{t('InkAge renders five moments, each based on how ink, skin and sun usually behave over time.', 'Az InkAge öt időpontot jelenít meg, mindegyiket aszerint, ahogy a tinta, a bőr és a nap általában viselkedik az idő során.')}</p>
      </div>
      <ol className="lm-tl">
        {stops.map((s) => (
          <li key={s.y}>
            <div className="lm-tl-img">
              <img src={s.img} alt="" loading="lazy" />
              <span>{s.y}</span>
            </div>
            <h3>{s.h}</h3>
            <p>{s.p}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ------------------------------------------------------------------ the details that make it realistic */
const ICONS: Record<string, string> = {
  cut: 'M6 6m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0M6 18m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0M8.1 8.1L20 20M14.5 9.5L20 4M8.1 15.9l3.4-3.4',
  skin: 'M12 3c3 4 6 7 6 11a6 6 0 0 1-12 0c0-4 3-7 6-11z',
  ruler: 'M3 17L17 3l4 4L7 21zM7 13l2 2M10 10l2 2M13 7l2 2',
  tone: 'M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18zM12 3v18',
  body: 'M12 5m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0M8 9h8l-1 6h-2l-1 6-1-6H9z',
  sun: 'M12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
};
export function Precision({ t }: { t: T }) {
  const items = [
    { i: 'cut', h: t('Smart cut-out', 'Okos kivágás'), p: t('Found the tattoo on someone else’s arm? We frame every design in the picture and cut out only the one you choose.', 'Más karján láttad? Minden mintát bekeretezünk a képen, és csak azt vágjuk ki, amelyiket választod.') },
    { i: 'skin', h: t('Only on skin', 'Csak bőrre'), p: t('A skin mask keeps the design off clothes, hair and background — like real ink would.', 'Egy bőrmaszk távol tartja a mintát a ruhától, a hajtól és a háttértől – ahogy a valódi tinta is.') },
    { i: 'ruler', h: t('Real centimetres', 'Valós centiméter'), p: t('Size shows in cm, with one-tap 3, 5, 8, 12 and 20 cm. Tiny detailed pieces get an honest warning.', 'A méret centiméterben látszik, egy koppintással 3, 5, 8, 12 és 20 cm. Apró, részletes mintánál őszinte figyelmeztetést kapsz.') },
    { i: 'tone', h: t('Your skin tone', 'A te bőrtónusod'), p: t('Every stage keeps your own skin tone and lighting, so the result looks like you, not a stock model.', 'Minden stádium megtartja a saját bőrtónusodat és fényeidet, így az eredmény rád hasonlít, nem egy modellre.') },
    { i: 'body', h: t('19 body areas', '19 testrész'), p: t('Pick the spot on a front and back body map; friction and sun for that area shape the result.', 'Válaszd ki a helyet az elöl- és hátulnézeti testtérképen; az adott terület súrlódása és napfénye alakítja az eredményt.') },
    { i: 'sun', h: t('Sun and habits', 'Nap és szokások'), p: t('Tell us how much sun the spot gets. More sun, faster fading — and you will see it.', 'Mondd meg, mennyi nap éri a helyet. Több nap, gyorsabb fakulás – és ezt látni is fogod.') },
  ];
  return (
    <section className="ls-sec lm-prec">
      <div className="ls-head">
        <h2>{t('The details that make it believable.', 'A részletek, amiktől hihető lesz.')}</h2>
      </div>
      <ul className="lm-prec-grid">
        {items.map((x) => (
          <li key={x.i}>
            <span className="lm-ico" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d={ICONS[x.i]} />
              </svg>
            </span>
            <h3>{x.h}</h3>
            <p>{x.p}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------ compared with the usual ways */
export function CompareTable({ t }: { t: T }) {
  const cols = [t('Imagining it', 'Elképzelés'), t('Temporary sticker', 'Matrica'), t('Artist’s sketch', 'Tetováló vázlata'), 'InkAge'];
  const rows: [string, number[]][] = [
    [t('On your own body', 'A saját testeden'), [0, 1, 0, 1]],
    [t('Exact size in cm', 'Pontos méret cm-ben'), [0, 1, 1, 1]],
    [t('Shows ageing over 50 years', 'Megmutatja az 50 éves öregedést'), [0, 0, 0, 1]],
    [t('Longevity score with reasons', 'Tartóssági pontszám indoklással'), [0, 0, 0, 1]],
    [t('Compare placements in minutes', 'Helyek összehasonlítása percek alatt'), [0, 0, 0, 1]],
    [t('Friends can vote from a link', 'Barátok szavazhatnak egy linken'), [0, 0, 0, 1]],
    [t('A human expert’s judgement', 'Szakember személyes véleménye'), [0, 0, 1, 0]],
  ];
  return (
    <section className="ls-sec lm-table">
      <div className="ls-head">
        <h2>{t('How it compares.', 'Összehasonlítva.')}</h2>
        <p className="lm-sub">{t('InkAge doesn’t replace your artist — it gets you to the consultation with a clearer idea.', 'Az InkAge nem helyettesíti a tetoválót – azt segíti, hogy tisztább elképzeléssel menj a konzultációra.')}</p>
      </div>
      <div className="lm-tbl-wrap">
        <table className="lm-tbl">
          <thead>
            <tr>
              <th scope="col">
                <span className="sr-only">{t('Feature', 'Funkció')}</span>
              </th>
              {cols.map((c, i) => (
                <th key={c} scope="col" className={i === 3 ? 'us' : ''}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([r, v]) => (
              <tr key={r}>
                <th scope="row">{r}</th>
                {v.map((x, i) => (
                  <td key={i} className={i === 3 ? 'us' : ''}>
                    {x ? <span className="yes" aria-label={t('Yes', 'Igen')} /> : <span className="no" aria-label={t('No', 'Nem')} />}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ privacy */
export function PrivacyBlock({ t }: { t: T }) {
  const pts = [
    { h: t('No account needed', 'Nem kell fiók'), p: t('Without signing in, your previews stay in your browser on this device.', 'Bejelentkezés nélkül az előnézeteid a böngésződben maradnak, ezen az eszközön.') },
    { h: t('Private by default', 'Alapból privát'), p: t('Signed in, previews live in your private storage. Only you can see them.', 'Bejelentkezve az előnézetek a privát tárhelyeden vannak. Csak te látod őket.') },
    { h: t('You choose what’s shared', 'Te döntöd el, mit osztasz meg'), p: t('A vote link shares only the fresh and the 50-year image. Delete the preview and the link is gone.', 'A szavazós link csak a friss és az 50 éves képet osztja meg. Ha törlöd az előnézetet, a link is eltűnik.') },
    { h: t('Delete everything, anytime', 'Bármikor törölhetsz mindent'), p: t('One button in your profile removes your account and every saved preview.', 'A profilodban egyetlen gombbal törölheted a fiókodat és minden mentett előnézetet.') },
  ];
  return (
    <section className="lm-priv">
      <div className="lm-priv-in">
        <div className="lm-priv-h">
          <span className="lm-lock" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
          </span>
          <h2>{t('Your photos are yours.', 'A fotóid a tieid.')}</h2>
          <p>{t('No advertising trackers, no third-party analytics, and nothing public unless you share it.', 'Nincsenek hirdetési követők, nincs külső analitika, és semmi sem nyilvános, amíg meg nem osztod.')}</p>
          <Link href="/privacy">{t('Read the privacy policy', 'Az adatvédelmi tájékoztató')}</Link>
        </div>
        <ul>
          {pts.map((x) => (
            <li key={x.h}>
              <b>{x.h}</b>
              <p>{x.p}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ free beta + add to home screen */
export function BetaInstall({ t }: { t: T }) {
  const [evt, setEvt] = useState<any>(null);
  const [ios, setIos] = useState(false);
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    setInstalled(window.matchMedia?.('(display-mode: standalone)').matches);
    const h = (e: any) => (e.preventDefault(), setEvt(e));
    window.addEventListener('beforeinstallprompt', h);
    return () => window.removeEventListener('beforeinstallprompt', h);
  }, []);
  return (
    <section className="ls-sec lm-beta" id="beta">
      <div className="lm-beta-card">
        <h2>{t('Everything is free during the beta.', 'A béta alatt minden ingyenes.')}</h2>
        <p>{t('All features, no card, no trial timer. We keep a fair daily limit so it stays free for everyone.', 'Minden funkció, kártya és próbaidő nélkül. Egy méltányos napi keretet tartunk, hogy mindenkinek ingyenes maradhasson.')}</p>
        <ul>
          <li>{t('Ageing previews at 1, 10, 30 and 50 years', 'Öregedési előnézet 1, 10, 30 és 50 évre')}</li>
          <li>{t('Longevity score and “Make it last” redraw', 'Tartóssági pontszám és „Tedd tartóssá” átrajzolás')}</li>
          <li>{t('Laser removal preview', 'Lézeres eltávolítás előnézete')}</li>
          <li>{t('Videos, vote links and the PDF for your artist', 'Videók, szavazós linkek és PDF a tetoválódnak')}</li>
        </ul>
        <Link className="btn" href="/app">
          {t('Start free', 'Ingyenes kezdés')}
        </Link>
      </div>
      <div className="lm-install" id="telepites">
        <img src={IMG('hf_20261013_090754_b336f404-4c34-4ef7-b5ba-a080d341d5db', 800)} alt="" loading="lazy" />
        <div>
          <h3>{t('Keep it on your home screen', 'Tedd ki a kezdőképernyőre')}</h3>
          {installed ? (
            <p>{t('InkAge is already installed on this device.', 'Az InkAge már telepítve van ezen az eszközön.')}</p>
          ) : evt ? (
            <>
              <p>{t('Opens full screen like an app, no app store needed.', 'Teljes képernyőn nyílik, mint egy app – alkalmazásbolt nélkül.')}</p>
              <button
                className="btn"
                onClick={async () => {
                  evt.prompt();
                  const r = await evt.userChoice.catch(() => null);
                  track('pwa_install', { outcome: r?.outcome });
                  setEvt(null);
                }}
              >
                {t('Install InkAge', 'InkAge telepítése')}
              </button>
            </>
          ) : ios ? (
            <ol>
              <li>{t('Open inkage.vercel.app in Safari', 'Nyisd meg az inkage.vercel.app oldalt Safariban')}</li>
              <li>{t('Tap the Share button', 'Koppints a Megosztás gombra')}</li>
              <li>{t('Choose “Add to Home Screen”', 'Válaszd a „Főképernyőhöz adás” lehetőséget')}</li>
            </ol>
          ) : (
            <ol>
              <li>{t('Open the browser menu (⋮)', 'Nyisd meg a böngésző menüjét (⋮)')}</li>
              <li>{t('Choose “Install app” or “Add to Home screen”', 'Válaszd az „Alkalmazás telepítése” vagy „Hozzáadás a kezdőképernyőhöz” lehetőséget')}</li>
            </ol>
          )}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ FAQ */
export function LandingFaq({ t, kbSfx }: { t: T; kbSfx: string }) {
  const qs = [
    [t('Is InkAge really free?', 'Tényleg ingyenes az InkAge?'), t('Yes. During the beta every feature is free. To keep it that way we use a fair daily limit; if it’s reached, you can leave your e-mail and we’ll tell you when previews are back.', 'Igen. A béta alatt minden funkció ingyenes. Hogy így maradhasson, méltányos napi keretet alkalmazunk; ha betelik, megadhatod az e-mail-címed, és szólunk, amint újra lehet előnézetet készíteni.')],
    [t('How accurate is the ageing?', 'Mennyire pontos az öregítés?'), t('It is an AI estimate based on how ink, skin and sun usually behave — not a measurement of your skin. Use it to compare designs, sizes and placements, and talk details through with your artist.', 'MI-alapú becslés arról, ahogy a tinta, a bőr és a nap általában viselkedik – nem a saját bőröd mérése. Minták, méretek és helyek összehasonlítására használd, a részleteket pedig beszéld át a tetoválóddal.')],
    [t('Do I need to sign up?', 'Kell regisztrálnom?'), t('Not for your first preview. Sign in only if you want your previews on every device.', 'Az első előnézethez nem. Csak akkor jelentkezz be, ha minden eszközödön látni szeretnéd az előnézeteidet.')],
    [t('What photo works best?', 'Milyen fotó működik a legjobban?'), t('Daylight, the spot in focus, filling most of the frame, without heavy filters. The app checks the light and focus for you.', 'Nappali fény, éles terület, ami kitölti a kép nagy részét, erős szűrők nélkül. Az app ellenőrzi helyetted a fényt és az élességet.')],
    [t('Can I use a design I found online?', 'Használhatok netről talált mintát?'), t('Yes — a screenshot, a sketch or even a photo of someone else’s tattoo. Remember that a design belongs to its artist: use it for inspiration and let your artist draw your own version.', 'Igen – képernyőfotót, vázlatot, vagy akár más tetoválásáról készült fotót is. Ne feledd, a minta az alkotójáé: inspirációnak használd, és a tetoválód rajzolja meg a saját változatodat.')],
    [t('Does it work on darker skin?', 'Sötétebb bőrön is működik?'), t('Yes. Every stage keeps your own skin tone. Our guide on tattoos on darker skin explains which colours and styles show best.', 'Igen. Minden stádium megtartja a saját bőrtónusodat. A sötétebb bőrről szóló útmutatónk elmagyarázza, mely színek és stílusok mutatnak a legjobban.')],
  ];
  return (
    <section className="ls-sec lm-faq">
      <div className="ls-head row-between">
        <h2>{t('Questions, answered.', 'Kérdések és válaszok.')}</h2>
        <Link className="ls-link" href={`/gyik${kbSfx}`}>
          {t('All questions', 'Összes kérdés')}
        </Link>
      </div>
      <div className="lm-faq-list">
        {qs.map(([q, a], i) => (
          <details key={i} onToggle={(e) => (e.currentTarget as HTMLDetailsElement).open && track('landing_faq', { i })}>
            <summary>{q}</summary>
            <p>{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
