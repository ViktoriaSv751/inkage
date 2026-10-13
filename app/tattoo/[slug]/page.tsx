import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { SEO_AREAS, SEO_STYLES, seoPage, seoSlugs } from '@/lib/seo';

export const dynamicParams = false;
export function generateStaticParams() {
  return seoSlugs().map((slug) => ({ slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const p = seoPage(params.slug, 'en');
  if (!p) return {};
  const title = `${p.s.en} tattoo on the ${p.a.en}: how it looks after 10, 30 and 50 years`;
  return { title: `${title} – InkAge`, description: `How a ${p.s.en.toLowerCase()} tattoo on the ${p.a.en} ages, which size lasts, and how to see it on your own skin.`, alternates: { canonical: `/tattoo/${params.slug}` } };
}

export default function SeoPage({ params, searchParams }: { params: { slug: string }; searchParams: { lang?: string } }) {
  const hu = searchParams.lang === 'hu';
  const L = hu ? 'hu' : 'en';
  const p = seoPage(params.slug, L);
  if (!p) notFound();
  const { s, a, report } = p;
  const T = (en: string, h: string) => (hu ? h : en);
  const verdict =
    report.score >= 75 ? T('This combination usually ages well.', 'Ez a kombináció általában jól öregszik.') : report.score >= 55 ? T('Good, with a few things to watch.', 'Jó választás, néhány dologra figyelni kell.') : T('Likely to blur or fade noticeably.', 'Valószínűleg észrevehetően elmosódik vagy fakul.');
  const related = SEO_AREAS.filter((x) => x.k !== a.k).slice(0, 4);
  return (
    <main className="legal" lang={L}>
      <p style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Link href="/">← InkAge</Link>
        <Link href={`/tattoo/${params.slug}${hu ? '' : '?lang=hu'}`}>{hu ? 'English' : 'Magyarul'}</Link>
      </p>
      <h1 style={{ fontSize: 'clamp(36px, 7vw, 56px)' }}>
        {T(`${s.en} tattoo on the ${a.en}: 10, 30 and 50 years later`, `${s.hu} tetoválás – ${a.hu}: 10, 30 és 50 év múlva`)}
      </h1>
      <p style={{ fontSize: 19 }}>
        <b>
          {T('Longevity score', 'Tartóssági pontszám')}: {report.score}/100.
        </b>{' '}
        {verdict}
      </p>
      <h2>{T('What changes over time', 'Mi változik az idő múlásával?')}</h2>
      <p>
        {T(
          `In the first year the ink settles and lines soften very slightly. Over 10 years ink spreads by roughly a tenth of a millimetre, so the finest details of a ${s.en.toLowerCase()} piece lose their edge first. By 30 years black drifts towards blue-grey and lines closer than about 1 mm can merge. At 50 years the skin on the ${a.en} is thinner and looser, so the design looks softer and a little wider.`,
          `Az első évben a tinta leülepszik, a vonalak picit lágyulnak. 10 év alatt a tinta kb. egytized millimétert terül, így egy ${s.hu.toLowerCase()} minta legfinomabb részletei veszítenek először az élességükből. 30 évre a fekete kékesszürke felé tolódik, és a kb. 1 mm-nél közelebbi vonalak összeérhetnek. 50 év múlva a bőr itt (${a.hu}) vékonyabb és lazább, így a minta lágyabbnak és kicsit szélesebbnek látszik.`
        )}
      </p>
      <h2>{T('Size matters', 'A méret számít')}</h2>
      <p>
        {T(`Same design, same place: about 4 cm scores ${p.small}, 8 cm scores ${p.medium} and 14 cm scores ${p.large}. Bigger gives fine details room to spread without merging.`, `Ugyanaz a minta, ugyanott: kb. 4 cm-en ${p.small}, 8 cm-en ${p.medium}, 14 cm-en ${p.large} pont. A nagyobb méretben a finom részleteknek van helyük szétterülni anélkül, hogy összefolynának.`)}
      </p>
      <h2>{T('What affects it most', 'Mi befolyásolja a legjobban?')}</h2>
      <ul>
        {report.factors.slice(0, 5).map((f) => (
          <li key={f.label}>
            <b>{f.impact > 0 ? `+${f.impact}` : f.impact}</b> {f.label}
          </li>
        ))}
        <li>{T(`Lots of sun drops the score to about ${p.sunny} — SPF 50 makes a real difference.`, `Sok nap mellett kb. ${p.sunny} pontra esik – az 50-es fényvédő tényleg sokat számít.`)}</li>
      </ul>
      {report.tips.length > 0 && (
        <>
          <h2>{T('Tips', 'Tippek')}</h2>
          <ul>
            {report.tips.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </>
      )}
      <div style={{ background: 'var(--ink)', color: '#fff', borderRadius: 24, padding: 22, margin: '32px 0' }}>
        <h2 style={{ color: '#fff', marginTop: 0 }}>{T('See it on your own skin', 'Nézd meg a saját bőrödön')}</h2>
        <p style={{ color: 'rgba(255,255,255,.8)' }}>{T('Upload a photo of your own body and any design. Free, about a minute, no sign-up.', 'Tölts fel egy fotót a saját testedről és bármilyen mintát. Ingyenes, kb. egy perc, regisztráció nélkül.')}</p>
        <Link className="btn light" href="/app">
          {T('Try it on my photo', 'Kipróbálom a fotómon')}
        </Link>
      </div>
      <h2>{T('Other areas', 'Más testrészek')}</h2>
      <p>
        {related.map((r) => (
          <span key={r.k} style={{ marginRight: 14, display: 'inline-block' }}>
            <Link href={`/tattoo/${s.k}-${r.k}${hu ? '?lang=hu' : ''}`}>{T(`${s.en} on the ${r.en}`, `${s.hu} – ${r.hu}`)}</Link>
          </span>
        ))}
      </p>
      <h2>{T('Other styles', 'Más stílusok')}</h2>
      <p>
        {SEO_STYLES.filter((x) => x.k !== s.k).map((x) => (
          <span key={x.k} style={{ marginRight: 14, display: 'inline-block' }}>
            <Link href={`/tattoo/${x.k}-${a.k}${hu ? '?lang=hu' : ''}`}>{T(`${x.en} on the ${a.en}`, `${x.hu} – ${a.hu}`)}</Link>
          </span>
        ))}
      </p>
      <p className="fine">{T('Estimates based on common tattoo-artist rules of thumb, not a medical prediction.', 'Tetoválók ökölszabályain alapuló becslés, nem orvosi előrejelzés.')}</p>
    </main>
  );
}
