import type { Metadata } from 'next';
import Link from 'next/link';
import { IMG, KB_HERO } from '@/lib/kb';
import { kbList } from '@/lib/kb-server';
import { KbList } from './KbList';
import { KbChrome } from './KbChrome';
import { SiteFooter } from '../SiteFooter';
import './kb.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Tudástár – InkAge',
  description: 'Őszinte, gyakorlati cikkek arról, hogyan öregszik a tetoválás: méret, stílus, hely, nap, utókezelés és eltávolítás.',
  alternates: { canonical: '/tudastar' },
};

export default function Tudastar({ searchParams }: { searchParams: { lang?: string } }) {
  const lang = searchParams.lang === 'en' ? 'en' : 'hu';
  const T = (en: string, hu: string) => (lang === 'hu' ? hu : en);
  return (
    <div className="kb-page">
      <KbChrome lang={lang} back={null} />
      <header className="kb-hero">
        <img src={IMG(KB_HERO, 1800)} alt="" />
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
      <KbList items={kbList(lang)} lang={lang} />
      <section className="kb-guides">
        <h2>{T('Every style, every body area', 'Minden stílus, minden testrész')}</h2>
        <p>{T('Scores and 50-year outlooks for 50 style and body-area combinations.', 'Pontszámok és 50 éves kilátások 50 stílus–testrész párosításra.')}</p>
        <Link className="kb-more" href={`/tattoo/fine-line-forearm${lang === 'hu' ? '?lang=hu' : ''}`}>
          {T('Open the guides', 'Megnyitom')} <span aria-hidden="true">→</span>
        </Link>
      </section>
      <div style={{ height: 80 }} />
      <SiteFooter lang={lang} />
    </div>
  );
}
