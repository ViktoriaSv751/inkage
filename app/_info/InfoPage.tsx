import Link from 'next/link';
import { KbChrome } from '../tudastar/KbChrome';
import { SiteFooter } from '../SiteFooter';
import { Blocks } from '../tudastar/[slug]/Blocks';
import { IMG } from '@/lib/kb';
import '../tudastar/kb.css';
import './info.css';

export type IconKey = keyof typeof ICONS;
export type InfoSec = { h: string; id?: string; ps: string[]; img?: string; icon?: IconKey; cards?: { i: IconKey; h: string; p: string }[] };
export type Lang = 'en' | 'hu';
export const langOf = (sp: { lang?: string }): Lang => (sp?.lang === 'en' ? 'en' : 'hu');

export const ICONS = {
  spark: 'M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z',
  shield: 'M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6zM9 12l2 2 4-4',
  lock: 'M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  cookie: 'M12 3a9 9 0 1 0 9 9 4 4 0 0 1-5-5 4 4 0 0 1-4-4zM8.5 11.5h.01M12 16h.01M15.5 13.5h.01',
  mail: 'M3 6h18v12H3zM3 7l9 6 9-6',
  clock: 'M12 21a9 9 0 1 0 0-18a9 9 0 0 0 0 18zM12 7v5l3 2',
  phone: 'M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM11 18h2',
  doc: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5',
  user: 'M12 12a4 4 0 1 0 0-8a4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  globe: 'M12 21a9 9 0 1 0 0-18a9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z',
  eye: 'M3 12s3.5-7 9-7 9 7 9 7-3.5 7-9 7-9-7-9-7zM12 9a3 3 0 1 0 0 6a3 3 0 0 0 0-6z',
  camera: 'M4 8h4l2-3h4l2 3h4v11H4zM12 17a4 4 0 1 0 0-8a4 4 0 0 0 0 8z',
  ruler: 'M3 17L17 3l4 4L7 21zM7 13l2 2M10 10l2 2M13 7l2 2',
  scissors: 'M6 9a3 3 0 1 0 0-6a3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6a3 3 0 0 0 0 6zM8.1 8.1L20 20M14.5 9.5L20 4M8.1 15.9l3.4-3.4',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  share: 'M12 15V3M7 8l5-5 5 5M5 13v7h14v-7',
  download: 'M12 3v12M7 10l5 5 5-5M5 21h14',
  scale: 'M12 3v18M5 7h14M5 7l-3 7a4 4 0 0 0 6 0zM19 7l-3 7a4 4 0 0 0 6 0z',
  gift: 'M4 10h16v10H4zM2 7h20v3H2zM12 7v13M12 7c-2-4-6-3-5 0M12 7c2-4 6-3 5 0',
  home: 'M4 10.5L12 4l8 6.5V20H4z',
  laser: 'M4 20l7-7M13 11l7-7M14 4h6v6M3 14l7 7',
};

export function Ico({ k }: { k: IconKey }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={ICONS[k]} />
    </svg>
  );
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** Shared shell for the product, company and legal pages. */
export function InfoPage({
  lang,
  path,
  kicker,
  kickerIcon = 'spark',
  title,
  lede,
  img,
  sections = [],
  toc = false,
  updated,
  highlights,
  related,
  children,
  cta = true,
  numbered = true,
}: {
  lang: Lang;
  path: string;
  kicker: string;
  kickerIcon?: IconKey;
  title: string;
  lede?: string;
  img?: string;
  sections?: InfoSec[];
  toc?: boolean;
  updated?: string;
  highlights?: { i: IconKey; h: string; p: string }[];
  related?: { href: string; t: string; p: string; i: IconKey }[];
  children?: React.ReactNode;
  cta?: boolean;
  numbered?: boolean;
}) {
  const T = (en: string, hu: string) => (lang === 'hu' ? hu : en);
  const secs = sections.map((s) => ({ ...s, id: s.id || slug(s.h) }));
  const q = lang === 'en' ? '?lang=en' : '';
  return (
    <div className="ip-page">
      <KbChrome lang={lang} path={path} />
      <header className={`ip-hero ${img ? "with-img" : ""} ${highlights ? "with-hl" : ""}`}>
        <div className="ip-hero-in">
          <p className="ip-kick">
            <span>
              <Ico k={kickerIcon} />
            </span>
            {kicker}
          </p>
          <h1>{title}</h1>
          {lede && <p className="ip-lede">{lede}</p>}
          {updated && (
            <p className="ip-upd">
              <Ico k="clock" />
              {T('Last updated', 'Utoljára frissítve')}: {updated}
            </p>
          )}
        </div>
        {img && (
          <figure className="ip-hero-img">
            <img src={IMG(img, 1800)} alt="" fetchPriority="high" />
          </figure>
        )}
        {highlights && (
          <ul className="ip-hl">
            {highlights.map((h) => (
              <li key={h.h}>
                <span className="ip-ico">
                  <Ico k={h.i} />
                </span>
                <b>{h.h}</b>
                <p>{h.p}</p>
              </li>
            ))}
          </ul>
        )}
      </header>

      <div className={`ip-body ${toc && secs.length > 2 ? 'with-toc' : ''}`}>
        {toc && secs.length > 2 && (
          <nav className="ip-toc" aria-label={T('On this page', 'Ezen az oldalon')}>
            <b>{T('On this page', 'Ezen az oldalon')}</b>
            <ol>
              {secs.map((s, i) => (
                <li key={s.id}>
                  <a href={`#${s.id}`}>
                    <span>{String(i + 1).padStart(2, '0')}</span>
                    {s.h}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        )}
        <div className="ip-main" lang={lang}>
          {secs.map((s, i) => (
            <section key={s.id} id={s.id} className={`ip-sec ${s.img ? 'has-img' : ''}`}>
              <div className="ip-sec-txt">
                <h2>
                  {s.icon ? (
                    <span className="ip-sec-ico">
                      <Ico k={s.icon} />
                    </span>
                  ) : numbered ? (
                    <span className="ip-sec-n">{String(i + 1).padStart(2, '0')}</span>
                  ) : null}
                  {s.h}
                </h2>
                <Blocks ps={s.ps} figs={{}} tip={T('Tip', 'Tipp')} />
                {s.cards && (
                  <ul className="ip-cards2">
                    {s.cards.map((c) => (
                      <li key={c.h}>
                        <span className="ip-ico">
                          <Ico k={c.i} />
                        </span>
                        <b>{c.h}</b>
                        <p>{c.p}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {s.img && (
                <figure className="ip-sec-img">
                  <img src={IMG(s.img, 1200)} alt="" loading="lazy" />
                </figure>
              )}
            </section>
          ))}
          {children}
        </div>
      </div>

      {related && related.length > 0 && (
        <section className="ip-related">
          <h2>{T('Related pages', 'Kapcsolódó oldalak')}</h2>
          <div className="ip-rel-grid">
            {related.map((r) => (
              <Link key={r.href} href={r.href.includes('?') || !q ? r.href : r.href + q} className="ip-rel">
                <span className="ip-ico">
                  <Ico k={r.i} />
                </span>
                <b>{r.t}</b>
                <p>{r.p}</p>
                <span className="ip-rel-go" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

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
