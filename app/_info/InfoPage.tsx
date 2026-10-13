import Link from 'next/link';
import { KbChrome } from '../tudastar/KbChrome';
import { SiteFooter } from '../SiteFooter';
import { Blocks } from '../tudastar/[slug]/Blocks';
import { IMG } from '@/lib/kb';
import '../tudastar/kb.css';
import './info.css';

export type InfoSec = { h: string; id?: string; ps: string[] };
export type Lang = 'en' | 'hu';
export const langOf = (sp: { lang?: string }): Lang => (sp?.lang === 'en' ? 'en' : 'hu');

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** Shared shell for the product, company and legal pages: top bar, hero, sections, footer. */
export function InfoPage({
  lang,
  path,
  kicker,
  title,
  lede,
  img,
  sections = [],
  toc = false,
  updated,
  children,
  cta = true,
}: {
  lang: Lang;
  path: string;
  kicker: string;
  title: string;
  lede?: string;
  img?: string;
  sections?: InfoSec[];
  toc?: boolean;
  updated?: string;
  children?: React.ReactNode;
  cta?: boolean;
}) {
  const T = (en: string, hu: string) => (lang === 'hu' ? hu : en);
  const secs = sections.map((s) => ({ ...s, id: s.id || slug(s.h) }));
  return (
    <div className="ip-page">
      <KbChrome lang={lang} back={null} light path={path} />
      <header className={`ip-hero ${img ? 'has-img' : ''}`}>
        {img && <img src={IMG(img, 1800)} alt="" fetchPriority="high" />}
        <div className="ip-hero-in">
          <p className="ip-kick">{kicker}</p>
          <h1>{title}</h1>
          {lede && <p className="ip-lede">{lede}</p>}
          {updated && (
            <p className="ip-upd">
              {T('Last updated', 'Utoljára frissítve')}: {updated}
            </p>
          )}
        </div>
      </header>
      <div className={`ip-body ${toc ? 'with-toc' : ''}`}>
        {toc && secs.length > 2 && (
          <nav className="ip-toc" aria-label={T('On this page', 'Ezen az oldalon')}>
            <b>{T('On this page', 'Ezen az oldalon')}</b>
            <ol>
              {secs.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`}>{s.h}</a>
                </li>
              ))}
            </ol>
          </nav>
        )}
        <div className="ip-main" lang={lang}>
          {secs.map((s) => (
            <section key={s.id} id={s.id} className="ip-sec">
              <h2>{s.h}</h2>
              <Blocks ps={s.ps} figs={{}} tip={T('Tip', 'Tipp')} />
            </section>
          ))}
          {children}
        </div>
      </div>
      {cta && (
        <section className="ip-cta">
          <div>
            <h2>{T('See it on your skin before it’s permanent.', 'Nézd meg a bőrödön, mielőtt végleges lesz.')}</h2>
            <p>{T('Free during the beta. No sign-up for your first preview.', 'A béta alatt ingyenes. Az első előnézethez nem kell regisztrálni.')}</p>
          </div>
          <Link href="/app">{T('Try it free', 'Kipróbálom ingyen')}</Link>
        </section>
      )}
      <SiteFooter lang={lang} />
    </div>
  );
}
