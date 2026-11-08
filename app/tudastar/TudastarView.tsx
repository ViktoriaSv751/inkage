import { tx, qOf, type Lang } from '@/lib/tr';
import Link from 'next/link';
import { IMG, IMGSET, KB_HERO } from '@/lib/kb';
import { kbList } from '@/lib/kb-server';
import { KbList } from './KbList';
import { KbChrome } from './KbChrome';
import { SiteFooter } from '../SiteFooter';
import { TOOL_LANGS } from '@/lib/tool-langs';
import './kb.css';

/** The knowledge base list. Inside the app (inApp) it keeps the app's frame and its links stay in the app. */
export function TudastarView({ lang, inApp = false }: { lang: Lang; inApp?: boolean }) {
  const T = (en: string, hu: string) => tx(lang, en, hu);
  return (
    <div className={`kb-page ${inApp ? 'kb-inapp' : ''}`}>
      {!inApp && <KbChrome lang={lang} back={null} />}
      <header className="kb-hero">
        <img src={IMG(KB_HERO, 1400)} srcSet={IMGSET(KB_HERO)} sizes="100vw" alt="" fetchPriority="high" />
        <div className="kb-hero-in">
          <p className="kb-eyebrow">{T('Practical guides before you get inked', 'Gyakorlati útmutatók a tetoválás előtt')}</p>
          <h1 className="kb-title">{T('Knowledge base', 'Tudástár')}</h1>
          <p className="kb-lede">
            {T(
              'Long, honest articles about what really happens to ink over the years, which size and placement last, and how to keep your tattoo looking new. Read them before you book.',
              'Hosszú, őszinte cikkek arról, mi történik valójában a tintával az évek alatt, milyen méret és hely bírja a legjobban, és hogyan marad újszerű a tetoválásod. Olvasd el, mielőtt időpontot foglalsz.'
            )}
          </p>
        </div>
      </header>
      <KbList items={kbList(lang)} lang={lang} base={inApp ? '/app/tudastar' : '/tudastar'} />
      <section className="kb-guides">
        <h2>{T('Every style, every body area', 'Minden stílus, minden testrész')}</h2>
        <p>{T('Scores and 50-year outlooks for 50 style and body-area combinations.', 'Pontszámok és 50 éves kilátások 50 stílus–testrész párosításra.')}</p>
        <Link className="kb-more" href={`${inApp ? '/app/tattoo' : '/tattoo'}/fine-line-forearm${qOf(lang)}`}>
          {T('Open the guides', 'Megnyitom')} <span aria-hidden="true">→</span>
        </Link>
      </section>
      {!inApp && TOOL_LANGS.includes(lang) && (
        <section className="kb-guides">
          <h2>{T('Try it on your own photo', 'Próbáld ki a saját fotódon')}</h2>
          <p>{T('See a design on your skin before you get it, and how a tattoo will look in 10, 30 and 50 years.', 'Nézd meg a mintát a bőrödön, mielőtt elkészül, és azt is, hogyan fog kinézni egy tetoválás 10, 30 és 50 év múlva.')}</p>
          <Link className="kb-more" href={`/tattoo-simulator${qOf(lang)}`}>
            {T('Tattoo simulator', 'Tetoválás szimulátor')} <span aria-hidden="true">→</span>
          </Link>
          <Link className="kb-more" href={`/tattoo-aging-simulator${qOf(lang)}`}>
            {T('Tattoo aging simulator', 'Tetoválás öregedés szimulátor')} <span aria-hidden="true">→</span>
          </Link>
          <Link className="kb-more" href={`/tattoo-removal-calculator${qOf(lang)}`}>
            {T('Laser tattoo removal calculator', 'Lézeres tetoválás-eltávolítás kalkulátor')} <span aria-hidden="true">→</span>
          </Link>
          <Link className="kb-more" href={`/tattoo-size-calculator${qOf(lang)}`}>
            {T('Tattoo size calculator', 'Tetoválás méretkalkulátor')} <span aria-hidden="true">→</span>
          </Link>
          <Link className="kb-more" href={`/szotar${qOf(lang)}`}>
            {T('Tattoo glossary', 'Tetoválás szótár')} <span aria-hidden="true">→</span>
          </Link>
        </section>
      )}
      <div style={{ height: inApp ? 20 : 80 }} />
      {!inApp && <SiteFooter lang={lang} />}
    </div>
  );
}
