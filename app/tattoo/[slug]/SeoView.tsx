import { tx, qOf, pick, type Lang } from '@/lib/tr';
import { TryLink } from '../../AuthCta';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SEO_AREAS, SEO_STYLES, seoPage } from '@/lib/seo';
import { IMG } from '@/lib/kb';
import { STYLE_IMG } from '@/lib/styleimg';
import { KbChrome } from '../../tudastar/KbChrome';
import { SiteFooter } from '../../SiteFooter';
import '../../tudastar/kb.css';
import './seo.css';

const tone = (v: number) => (v >= 75 ? 'good' : v >= 55 ? 'mid' : 'low');

/** A style × body-area guide. Inside the app (inApp) it keeps the app's frame and its links stay in the app. */
export function SeoView({ slug, L, inApp = false }: { slug: string; L: Lang; inApp?: boolean }) {
  const base = inApp ? '/app/tattoo' : '/tattoo';
  const p = seoPage(slug, L);
  if (!p) notFound();
  const { s, a, report } = p;
  const T = (en: string, h: string) => tx(L, en, h);
  const q = qOf(L);
  const sN = pick(s, L);
  const aN = pick(a, L);
  const verdict =
    report.score >= 75 ? T('This combination usually ages well.', 'Ez a kombináció általában jól öregszik.') : report.score >= 55 ? T('A good choice, with a few things to watch.', 'Jó választás, néhány dologra figyelni kell.') : T('Likely to blur or fade noticeably.', 'Valószínűleg észrevehetően elmosódik vagy fakul.');
  const areas = SEO_AREAS.map((x) => ({ x, v: seoPage(`${s.k}-${x.k}`, L)?.medium ?? 0 })).sort((m, n) => n.v - m.v);
  const stages = [
    { y: T('1 year', '1 év'), h: T('Settled', 'Leülepedett'), p: T('The ink settles and lines soften very slightly.', 'A tinta leülepszik, a vonalak picit lágyulnak.') },
    { y: T('10 years', '10 év'), h: T('Softer details', 'Lágyabb részletek'), p: T(`Ink spreads roughly a tenth of a millimetre; the finest details of a ${s.en.toLowerCase()} piece lose their edge first.`, `A tinta kb. egytized millimétert terül; egy ${s.hu.toLowerCase()} minta legfinomabb részletei veszítenek először az élességükből.`) },
    { y: T('30 years', '30 év'), h: T('Blue-grey black', 'Kékesszürke fekete'), p: T('Black drifts towards blue-grey and lines closer than about 1 mm can merge.', 'A fekete kékesszürke felé tolódik, a kb. 1 mm-nél közelebbi vonalak összeérhetnek.') },
    { y: T('50 years', '50 év'), h: T('Ageing skin', 'Öregedő bőr'), p: T(`The skin on the ${a.en} is thinner and looser, so the design looks softer and a little wider.`, `A bőr itt (${a.hu}) vékonyabb és lazább, így a minta lágyabb és kicsit szélesebb.`) },
  ];
  return (
    <div className={`sp-page ${inApp ? 'sp-inapp' : ''}`} lang={L}>
      {!inApp && <KbChrome lang={L} path={`/tattoo/${slug}`} />}

      <header className="sp-hero">
        <div className="sp-hero-txt">
          <nav className="sp-bc" aria-label={T('Breadcrumb', 'Morzsamenü')}>
            <Link href={inApp ? `/app/tudastar${q}` : `/${q}`}>{inApp ? T('Knowledge base', 'Tudástár') : 'InkAge'}</Link>
            <span>/</span>
            <span>{T('Styles × body areas', 'Stílusok × testrészek')}</span>
          </nav>
          <h1>
            {sN}
            <span>
              {T('on the', '–')} {aN}
            </span>
          </h1>
          <p className="sp-lede">{T('How it looks after 10, 30 and 50 years — and what makes it last.', 'Így néz ki 10, 30 és 50 év múlva – és ettől lesz tartós.')}</p>
          <div className="sp-verdict">
            <div className={`sp-ring ${tone(report.score)}`} style={{ ['--v' as any]: report.score }}>
              <b>{report.score}</b>
              <small>/100</small>
            </div>
            <div>
              <span>{T('Longevity score', 'Tartóssági pontszám')}</span>
              <b>{verdict}</b>
              <small>{T('8 cm, average sun', '8 cm, átlagos napfény')}</small>
            </div>
          </div>
        </div>
        <figure className="sp-hero-img">
          <img src={IMG(STYLE_IMG[s.k], 1200)} alt="" fetchPriority="high" />
          <figcaption>{sN}</figcaption>
        </figure>
      </header>

      <div className="sp-wrap">
        <section className="sp-sec">
          <h2>{T('Size matters', 'A méret számít')}</h2>
          <p className="sp-sub">{T('Same design, same place — only the size changes.', 'Ugyanaz a minta, ugyanott – csak a méret változik.')}</p>
          <div className="sp-sizes">
            {[
              ['4 cm', p.small],
              ['8 cm', p.medium],
              ['14 cm', p.large],
              [T('8 cm, lots of sun', '8 cm, sok nap'), p.sunny],
            ].map(([k, v]) => (
              <div key={k as string} className={`sp-size ${tone(v as number)}`}>
                <span>{k}</span>
                <b>{v}</b>
                <i>
                  <em style={{ width: `${v}%` }} />
                </i>
              </div>
            ))}
          </div>
        </section>

        <section className="sp-sec">
          <h2>{T('What changes over time', 'Mi változik az idő múlásával?')}</h2>
          <ol className="sp-time">
            {stages.map((x) => (
              <li key={x.y}>
                <span className="sp-y">{x.y}</span>
                <b>{x.h}</b>
                <p>{x.p}</p>
              </li>
            ))}
          </ol>
        </section>

        <div className="sp-two">
          <section className="sp-sec">
            <h2>{T('What affects it most', 'Mi befolyásolja a legjobban?')}</h2>
            <ul className="sp-factors">
              {report.factors.slice(0, 5).map((f) => (
                <li key={f.label}>
                  <span className={f.impact > 0 ? 'up' : 'down'}>{f.impact > 0 ? `+${f.impact}` : f.impact}</span>
                  {f.label}
                </li>
              ))}
              <li>
                <span className="down">☀</span>
                {T(`Lots of sun drops the score to about ${p.sunny} — SPF 50 makes a real difference.`, `Sok nap mellett kb. ${p.sunny} pontra esik – az 50-es fényvédő tényleg sokat számít.`)}
              </li>
            </ul>
          </section>
          {report.tips.length > 0 && (
            <section className="sp-sec">
              <h2>{T('Tips', 'Tippek')}</h2>
              <ul className="sp-tips">
                {report.tips.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <section className="sp-cta">
          <div>
            <h2>{T('See it on your own skin', 'Nézd meg a saját bőrödön')}</h2>
            <p>{T('Upload a photo of your own body and any design. Free after a one-tap sign-up.', 'Tölts fel egy fotót a saját testedről és bármilyen mintát. Egy koppintásos regisztráció után ingyenes.')}</p>
          </div>
          <TryLink lang={L}>{inApp ? T('Try it on my photo', 'Kipróbálom a fotómon') : T('Register and try it', 'Regisztrálok és kipróbálom')}</TryLink>
        </section>

        <section className="sp-sec">
          <h2>
            {sN}: {T('every body area', 'minden testrész')}
          </h2>
          <ol className="sp-areas">
            {areas.map(({ x, v }) => (
              <li key={x.k}>
                <Link href={`${base}/${s.k}-${x.k}${q}`} className={x.k === a.k ? 'on' : ''} aria-current={x.k === a.k ? 'page' : undefined}>
                  <span>{pick(x, L)}</span>
                  <i>
                    <em className={tone(v)} style={{ width: `${v}%` }} />
                  </i>
                  <b>{v}</b>
                </Link>
              </li>
            ))}
          </ol>
        </section>

        <section className="sp-sec">
          <h2>
            {T('Other styles on the', 'Más stílusok –')} {aN}
          </h2>
          <div className="sp-styles">
            {SEO_STYLES.map((x) => (
              <Link key={x.k} href={`${base}/${x.k}-${a.k}${q}`} className={x.k === s.k ? 'on' : ''}>
                <img src={IMG(STYLE_IMG[x.k], 400)} alt="" loading="lazy" />
                <span>{L === 'hu' ? x.hu.replace(/ \(.*\)/, '') : x.en}</span>
              </Link>
            ))}
          </div>
        </section>

        <p className="sp-fine">{T('Estimates based on common tattoo-artist rules of thumb, not a medical prediction.', 'Tetoválók ökölszabályain alapuló becslés, nem orvosi előrejelzés.')}</p>
      </div>
      {!inApp && <SiteFooter lang={L} />}
    </div>
  );
}
