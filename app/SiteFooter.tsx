import { tx, qOf, type Lang } from '@/lib/tr';
import Link from 'next/link';
import { FooterLang, FooterSignup } from './FooterSignup';
import './footer.css';
import { LogoMark } from './LogoMark';
import { TOOL_LANGS } from '@/lib/tool-langs';

/* Directory listings that require their badge (with a followed link) on the home page or footer
   to keep InkAge listed. Remove a badge only together with its listing. Added 2026-11-09. */
const FEATURED: { href: string; src: string; alt: string }[] = [
  { href: 'https://aitechviral.com/ai/inkage', src: 'https://aitechviral.com/assets/images/badge.png', alt: 'AI Tech Viral' },
  { href: 'https://goodaitools.com/ai/inkage', src: 'https://goodaitools.com/assets/images/badge.png', alt: 'Good AI Tools' },
  { href: 'https://acidtools.com/ai/inkage', src: 'https://acidtools.com/assets/images/badge.png', alt: 'Acid Tools' },
  { href: 'https://kickproduct.com/products/inkage', src: 'https://www.kickproduct.com/listedbadge.png', alt: 'Listed on Kick Product' },
  { href: 'https://showmebest.ai', src: 'https://showmebest.ai/badge/feature-badge-white.webp', alt: 'Featured on ShowMeBestAI' },
  { href: 'https://twelve.tools/', src: 'https://twelve.tools/badge0-white.svg', alt: 'Featured on Twelve Tools' },
  { href: 'https://startupfa.me/s/inkage?utm_source=inkage.app', src: 'https://startupfa.me/badge?t=classic&theme=default', alt: 'InkAge - Featured on Startup Fame' },
  { href: 'https://www.toolpilot.ai', src: 'https://www.toolpilot.ai/cdn/shop/files/f-w_690x151_crop_center.png', alt: 'Featured on ToolPilot' },
];

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
        // the tool pages, only in the languages they are written in
        ...(TOOL_LANGS.includes(lang)
          ? [
              { t: T('Tattoo simulator', 'Tetoválás szimulátor'), href: `/tattoo-simulator${q}` },
              { t: T('Aging simulator', 'Öregedés szimulátor'), href: `/tattoo-aging-simulator${q}` },
            ]
          : []),
        { t: T('Styles', 'Stílusok'), href: `/tattoo/fine-line-forearm${qOf(lang)}` },
        { t: T('Beta', 'Béta'), href: `/ingyenes-beta${q}` },
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
            /* the most searched articles (Search Console 2026-11), each written in all 35 languages; see lib/kb-links.ts */
            ['tattoo-before-and-after', T('Before and after', 'Előtte és utána')],
            ['laser-tattoo-removal-what-to-expect', T('Laser removal', 'Lézeres eltávolítás')],
            ['laser-removal-how-many-sessions', T('Removal sessions', 'Hány kezelés kell?')],
            ['tattoo-pain-chart', T('Pain chart', 'Fájdalomtérkép')],
            ['how-tattoos-age', T('How tattoos age', 'Öregedés')],
          ] as const
        ).map(([s, t]) => ({ t, href: `/tudastar/${s}${q}` })),
        // the calculator, glossary and editorial pages, only in the languages they are written in
        ...(TOOL_LANGS.includes(lang)
          ? [
              { t: T('Removal calculator', 'Eltávolítás kalkulátor'), href: `/tattoo-removal-calculator${q}` },
              { t: T('Size calculator', 'Méretkalkulátor'), href: `/tattoo-size-calculator${q}` },
              { t: T('Glossary', 'Szótár'), href: `/szotar${q}` },
              { t: T('Editorial standards', 'Szerkesztési irányelvek'), href: `/szerkesztoseg${q}` },
            ]
          : []),
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
            <Link href={`/${q}`} className="sf-logo" aria-label="InkAge">
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

        <div className="sf-featured">
          <b>{T('Featured on', 'Megjelent itt')}</b>
          <div className="sf-badges">
            {FEATURED.map((f) => (
              <a key={f.href} href={f.href} target="_blank" rel="noopener">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.src} alt={f.alt} height={40} loading="lazy" decoding="async" />
              </a>
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

