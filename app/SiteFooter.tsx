import Link from 'next/link';
import { ARTICLES } from '@/lib/articles';
import { FooterLang, FooterSignup } from './FooterSignup';
import './footer.css';

/** The site-wide footer: brand + sign-up, five link columns, copyright and language. */
export function SiteFooter({ lang, hideLang = false }: { lang: 'en' | 'hu'; hideLang?: boolean }) {
  const T = (en: string, hu: string) => (lang === 'hu' ? hu : en);
  const q = lang === 'en' ? '?lang=en' : '';
  const cols: { h: string; links: { t: string; href: string }[] }[] = [
    {
      h: T('Product', 'Termék'),
      links: [
        { t: T('How it works', 'Hogyan működik'), href: `/hogyan-mukodik${q}` },
        { t: T('Features', 'Funkciók'), href: `/funkciok${q}` },
        { t: T('Styles by body area', 'Stílusok testrészenként'), href: `/tattoo/fine-line-forearm${lang === 'hu' ? '?lang=hu' : ''}` },
        { t: T('Free beta', 'Ingyenes béta'), href: `/funkciok${q}#beta` },
        { t: T('FAQ', 'GYIK'), href: `/gyik${q}` },
      ],
    },
    {
      h: T('App', 'Alkalmazás'),
      links: [
        { t: T('Open InkAge', 'InkAge megnyitása'), href: '/app' },
        { t: T('Explore designs', 'Minták felfedezése'), href: '/app/explore' },
        { t: T('My previews', 'Előnézeteim'), href: '/app/gallery' },
        { t: T('Add to home screen', 'Telepítés a kezdőképernyőre'), href: `/hogyan-mukodik${q}#telepites` },
      ],
    },
    {
      h: T('Knowledge', 'Tudás'),
      links: [
        { t: T('Knowledge base', 'Tudástár'), href: `/tudastar${q}` },
        ...['how-tattoos-age', 'fine-line-tattoos-aging', 'best-placement-for-tattoo-longevity', 'tattoo-aftercare-sun-protection', 'first-tattoo-checklist'].map((s) => {
          const a = ARTICLES.find((x) => x.slug === s)!;
          return { t: shortTitle(a.title[lang]), href: `/tudastar/${s}${q}` };
        }),
      ],
    },
    {
      h: T('Company', 'Cég'),
      links: [
        { t: T('What is InkAge?', 'Mi az InkAge?'), href: `/rolunk${q}#mi-az` },
        { t: T('About us', 'Rólunk'), href: `/rolunk${q}` },
        { t: T('Contact', 'Kapcsolat'), href: `/kapcsolat${q}` },
        { t: T('Data security', 'Adatbiztonság'), href: `/adatbiztonsag${q}` },
      ],
    },
    {
      h: T('Legal', 'Jog'),
      links: [
        { t: T('Terms of use', 'ÁSZF'), href: `/terms${q}` },
        { t: T('Privacy policy', 'Adatvédelem'), href: `/privacy${q}` },
        { t: T('Delete account', 'Fiók törlése'), href: `/fiok-torlese${q}` },
        { t: T('Cookie notice', 'Süti tájékoztató'), href: `/suti${q}` },
      ],
    },
  ];
  return (
    <footer className="sf" lang={lang}>
      <div className="sf-in">
        <div className="sf-top">
          <div className="sf-brand">
            <Link href="/" className="sf-logo" aria-label="InkAge">
              <svg viewBox="0 0 64 64" aria-hidden="true">
                <circle cx="32" cy="32" r="30" />
                <path d="M38 14a20 20 0 1 0 0 36a16 16 0 1 1 0-36z" />
              </svg>
              InkAge
            </Link>
            <p>{T('See any tattoo on your own skin — fresh, and 10, 30 and 50 years later — before it’s permanent.', 'Nézd meg bármelyik tetoválást a saját bőrödön – frissen, majd 10, 30 és 50 év múlva –, mielőtt végleges lesz.')}</p>
            <div className="sf-sub">
              <b>{T('New guides, once a month', 'Új útmutatók, havonta egyszer')}</b>
              <FooterSignup lang={lang} />
            </div>
          </div>
          <div className="sf-grid">
            {cols.map((c) => (
              <nav key={c.h} className="sf-col" aria-label={c.h}>
                <b>{c.h}</b>
                {c.links.map((l) => (
                  <Link key={l.href + l.t} href={l.href}>
                    {l.t}
                  </Link>
                ))}
              </nav>
            ))}
          </div>
        </div>

        <div className="sf-bottom">
          <div className="sf-copy">
            <span>© 2026 InkAge</span>
            <span>{T('Previews are AI estimates, not a guarantee or medical advice.', 'Az előnézetek MI-alapú becslések, nem garanciák és nem orvosi tanácsok.')}</span>
          </div>
          {!hideLang && <FooterLang lang={lang} />}
        </div>
      </div>
    </footer>
  );
}

/** "Long title: subtitle" → "Long title" (keeps footer links short). */
function shortTitle(t: string) {
  return t.split(/[:?]/)[0].trim();
}
