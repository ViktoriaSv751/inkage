import { tx, qOf, type Lang } from '@/lib/tr';
import Link from 'next/link';
import { FooterLang, FooterSignup } from './FooterSignup';
import './footer.css';
import { LogoMark } from './LogoMark';

/** The site-wide footer: brand + sign-up, five link columns, copyright and language. */
export function SiteFooter({ lang, hideLang = false }: { lang: Lang; hideLang?: boolean }) {
  const T = (en: string, hu: string) => tx(lang, en, hu);
  const q = qOf(lang);
  const cols: { h: string; links: { t: string; href: string }[] }[] = [
    {
      h: T('Product', 'Termék'),
      links: [
        { t: T('How it works', 'Hogyan működik'), href: `/hogyan-mukodik${q}` },
        { t: T('Features', 'Funkciók'), href: `/funkciok${q}` },
        { t: T('Styles', 'Stílusok'), href: `/tattoo/fine-line-forearm${qOf(lang)}` },
        { t: T('Free beta', 'Ingyenes béta'), href: `/ingyenes-beta${q}` },
        { t: T('FAQ', 'GYIK'), href: `/gyik${q}` },
      ],
    },
    {
      h: T('App', 'Alkalmazás'),
      links: [
        { t: T('Open app', 'Megnyitás'), href: '/app' },
        { t: T('Designs', 'Minták'), href: '/app/explore' },
        { t: T('My previews', 'Előnézeteim'), href: '/app/gallery' },
        { t: T('Install', 'Telepítés'), href: `/telepites${q}` },
      ],
    },
    {
      h: T('Knowledge', 'Tudás'),
      links: [
        { t: T('All guides', 'Tudástár'), href: `/tudastar${q}` },
        ...(
          [
            ['how-tattoos-age', T('How tattoos age', 'Öregedés')],
            ['fine-line-tattoos-aging', T('Fine line', 'Fine line')],
            ['best-placement-for-tattoo-longevity', T('Best spots', 'Legjobb helyek')],
            ['tattoo-aftercare-sun-protection', T('Aftercare', 'Utókezelés')],
            ['first-tattoo-checklist', T('First tattoo', 'Első tetoválás')],
          ] as const
        ).map(([s, t]) => ({ t, href: `/tudastar/${s}${q}` })),
      ],
    },
    {
      h: T('Company', 'Cég'),
      links: [
        { t: T('What is InkAge?', 'Mi az InkAge?'), href: `/mi-az-inkage${q}` },
        { t: T('About us', 'Rólunk'), href: `/rolunk${q}` },
        { t: T('Contact', 'Kapcsolat'), href: `/kapcsolat${q}` },
        { t: T('Data security', 'Adatbiztonság'), href: `/adatbiztonsag${q}` },
      ],
    },
    {
      h: T('Legal', 'Jog'),
      links: [
        { t: T('Overview', 'Áttekintés'), href: `/jog${q}` },
        { t: T('Terms', 'ÁSZF'), href: `/terms${q}` },
        { t: T('Privacy', 'Adatvédelem'), href: `/privacy${q}` },
        { t: T('Delete account', 'Fiók törlése'), href: `/fiok-torlese${q}` },
        { t: T('Cookies', 'Sütik'), href: `/suti${q}` },
      ],
    },
  ];
  return (
    <footer className="sf" lang={lang}>
      <div className="sf-in">
        <div className="sf-top">
          <div className="sf-brand">
            <Link href="/" className="sf-logo" aria-label="InkAge">
              <LogoMark />
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

