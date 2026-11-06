import { tx, qOf, htmlLang, type Lang } from '@/lib/tr';
import { SITE_URL } from '@/lib/site';
import { InfoPage, Ico, type IconKey } from '../_info/InfoPage';
import { ToolCta, ToolSlider } from './ToolBits';
import './tool.css';

export type ToolContent = {
  path: '/tattoo-simulator' | '/tattoo-aging-simulator';
  kicker: string;
  title: string;
  lede: string;
  /** the page's short description, also used in the JSON-LD */
  desc: string;
  about: { h: string; ps: string[] };
  steps: { i: IconKey; h: string; p: string }[];
  faq: [string, string][];
  related: { href: string; t: string; p: string; i: IconKey }[];
};

/** A landing page for a tool search ("tattoo simulator", "tattoo aging simulator"): the slider and the button first,
    then a short honest explanation, three steps and the questions people ask. */
export function ToolPage({ lang, c }: { lang: Lang; c: ToolContent }) {
  const T = (en: string, hu: string) => tx(lang, en, hu);
  const page = c.path.slice(1);
  const url = `${SITE_URL}${c.path}${qOf(lang)}`;
  const ctaLabel = T('Try it on my photo', 'Kipróbálom a fotómon');
  const ctaSmall = T('One-tap sign-up with Google or Apple · 30 previews a month · About a minute', 'Egy koppintásos Google- vagy Apple-regisztráció · Havi 30 előnézet · Kb. egy perc');
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'InkAge',
      url,
      description: c.desc,
      inLanguage: htmlLang(lang),
      applicationCategory: 'LifestyleApplication',
      operatingSystem: 'Web, iOS, Android',
      featureList: c.steps.map((s) => s.h).join(', '),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      inLanguage: htmlLang(lang),
      mainEntity: c.faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
    },
  ];
  return (
    <InfoPage lang={lang} path={c.path} kicker={c.kicker} kickerIcon="camera" title={c.title} lede={c.lede} related={c.related} cta={false}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="tl-top">
        <ToolSlider lang={lang} />
        <div className="tl-cta">
          <ToolCta page={page} lang={lang} where="top">
            {ctaLabel}
          </ToolCta>
          <small>{ctaSmall}</small>
        </div>
      </div>

      <section className="ip-sec">
        <div className="ip-sec-txt">
          <h2>
            <span className="ip-sec-ico">
              <Ico k="eye" />
            </span>
            {c.about.h}
          </h2>
          {c.about.ps.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
      </section>

      <section className="ip-sec">
        <div className="ip-sec-txt">
          <h2>
            <span className="ip-sec-ico">
              <Ico k="spark" />
            </span>
            {T('How it works, in three steps', 'Így működik, három lépésben')}
          </h2>
          <ol className="tl-steps">
            {c.steps.map((s, i) => (
              <li key={s.h}>
                <span className="tl-n">{i + 1}</span>
                <span className="ip-ico">
                  <Ico k={s.i} />
                </span>
                <b>{s.h}</b>
                <p>{s.p}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="ip-sec">
        <div className="ip-sec-txt">
          <h2>
            <span className="ip-sec-ico">
              <Ico k="doc" />
            </span>
            {T('Questions and answers', 'Kérdések és válaszok')}
          </h2>
          <div className="ip-faq">
            {c.faq.map(([q, a]) => (
              <details key={q}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="tl-end">
        <div>
          <h2>{T('See it on your skin before it’s permanent.', 'Nézd meg a bőrödön, mielőtt végleges lesz.')}</h2>
          <p>{ctaSmall}</p>
        </div>
        <ToolCta page={page} lang={lang} where="end">
          {ctaLabel}
        </ToolCta>
      </section>
    </InfoPage>
  );
}
