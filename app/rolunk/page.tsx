import READY from '@/lib/locales/ready.json';
import { tx, qOf } from '@/lib/tr';
import type { Metadata } from 'next';
import Link from 'next/link';
import { IMG } from '@/lib/kb';
import { Ico, InfoPage, langOf, type IconKey } from '../_info/InfoPage';
import './about.css';

export const dynamic = 'force-dynamic';
export function generateMetadata({ searchParams }: { searchParams: { lang?: string } }): Metadata {
  const L = langOf(searchParams);
  return {
    title: tx(L, 'About – InkAge', 'Rólunk – InkAge'),
    description:
      tx(L, 'Why we built InkAge, what we believe, and how an aging preview is made.', 'Miért építettük az InkAge-et, miben hiszünk, és hogyan készül egy öregedési előnézet.'),
  };
}

export default function Page({ searchParams }: { searchParams: { lang?: string } }) {
  const L = langOf(searchParams);
  const T = (en: string, hu: string) => tx(L, en, hu);
  const q = qOf(L);

  const beliefs: { i: IconKey; h: string; p: string }[] = [
    { i: 'eye', h: T('Honest previews', 'Őszinte előnézetek'), p: T('Every image is an AI estimate, and we label it that way. We never promise how your skin will age.', 'Minden kép MI-becslés, és így is jelöljük. Soha nem ígérjük meg, hogyan fog öregedni a bőröd.') },
    { i: 'heart', h: T('Artists come first', 'A tetoválók az elsők'), p: T('We help you arrive at the consultation with a clearer idea. The craft, the needle and the final call stay with your artist.', 'Abban segítünk, hogy tisztább elképzeléssel érkezz a konzultációra. A szakértelem, a tű és a végső döntés a tetoválódé.') },
    { i: 'lock', h: T('Your photos are yours', 'A fotóid a tieid'), p: T('No advertising trackers, no third-party analytics. Nothing is public unless you share it yourself.', 'Nincsenek hirdetési követők, nincs külső analitika. Semmi sem nyilvános, amíg te magad meg nem osztod.') },
    { i: 'check', h: T('No fake social proof', 'Nincs hamis visszaigazolás'), p: T('No invented reviews, no inflated user counts, no stock testimonials. If we show it, it’s real.', 'Nincsenek kitalált értékelések, felfújt felhasználószámok vagy stock vélemények. Amit mutatunk, az valódi.') },
  ];

  const factors: { i: IconKey; h: string; p: string }[] = [
    { i: 'spark', h: T('Ink spread', 'A tinta szétterülése'), p: T('Lines slowly widen as the body moves pigment. Fine details close together merge first.', 'A vonalak lassan kiszélesednek, ahogy a szervezet mozgatja a pigmentet. Az egymáshoz közeli finom részletek folynak össze először.') },
    { i: 'clock', h: T('Sun exposure', 'Napfény'), p: T('UV light breaks down pigment. Your answer about sun habits changes how fast the preview fades.', 'Az UV-fény bontja a pigmentet. Amit a napozási szokásaidról mondasz, az megváltoztatja, milyen gyorsan fakul az előnézet.') },
    { i: 'ruler', h: T('Placement and friction', 'Testrész és súrlódás'), p: T('Hands, fingers and feet rub and renew fast. Upper arms and backs usually hold up longer.', 'A kéz, az ujjak és a láb sokat súrlódnak és gyorsan megújulnak. A felkar és a hát általában tovább bírja.') },
    { i: 'scale', h: T('Size and line weight', 'Méret és vonalvastagság'), p: T('Small, delicate designs have less room to blur gracefully. Bolder lines keep their shape longer.', 'A kicsi, finom mintáknak kevesebb helyük van szépen elmosódni. A vastagabb vonalak tovább tartják a formájukat.') },
    { i: 'camera', h: T('Colour', 'Szín'), p: T('Black lasts longest. Yellows, pastels and light blues tend to fade first.', 'A fekete tart a legtovább. A sárga, a pasztell és a világoskék általában előbb fakul.') },
    { i: 'user', h: T('Your skin', 'A bőröd'), p: T('Every stage keeps your own skin tone, light and body shape, so you see your tattoo — not a model’s.', 'Minden stádium megtartja a bőrtónusodat, a fényeidet és a tested formáját, így a saját tetoválásodat látod – nem egy modellét.') },
  ];

  return (
    <InfoPage
      lang={L}
      path="/rolunk"
      kicker={T('About', 'Rólunk')}
      kickerIcon="heart"
      title={T('Love it on day one. And in fifty years.', 'Szeresd az első napon. És ötven év múlva is.')}
      lede={T(
        'InkAge is a small independent team building one honest tool: a way to see a tattoo on your own skin across a lifetime, before it becomes permanent.',
        'Az InkAge egy kis, független csapat, amely egyetlen őszinte eszközt épít: hogy a saját bőrödön láthasd egy tetoválás egész életét, mielőtt végleges lesz.'
      )}
      img="hf_20261013_090802_c2968625-4757-4c65-8bfd-d6c8e7ff7d3a"
      related={[
        { href: '/mi-az-inkage', t: T('What is InkAge?', 'Mi az InkAge?'), p: T('The product in two minutes.', 'A termék két percben.'), i: 'spark' },
        { href: '/kapcsolat', t: T('Contact', 'Kapcsolat'), p: T('Ideas, questions, bug reports.', 'Ötletek, kérdések, hibajelentések.'), i: 'mail' },
        { href: '/adatbiztonsag', t: T('Data security', 'Adatbiztonság'), p: T('How your photos are protected.', 'Így védjük a fotóidat.'), i: 'shield' },
      ]}
    >
      <div className="ab" lang={L}>
        {/* the problem: day one vs. a lifetime */}
        <section className="ab-problem">
          <div className="ab-problem-txt">
            <p className="ab-eyebrow">{T('Why we built it', 'Miért építettük')}</p>
            <h2>{T('The internet shows day one. You live with day eighteen thousand.', 'A net az első napot mutatja. Te a tizennyolcezredikkel élsz.')}</h2>
            <p>
              {T(
                'Almost every tattoo photo online is taken the week it was finished: sharp, dark, freshly moisturised. Year ten or year thirty is almost never shown — yet that is the tattoo you will actually wear.',
                'Szinte minden tetoválásfotó a neten az elkészülés hetében készül: éles, sötét, frissen bekrémezett. A tizedik vagy a harmincadik évet szinte soha nem mutatják – pedig valójában azt a tetoválást fogod viselni.'
              )}
            </p>
            <p>
              {T(
                'InkAge exists for the moment between “I love this design” and the chair. That is when a different size, a bolder line or another spot costs nothing to change.',
                'Az InkAge az „imádom ezt a mintát” és a tetoválószék közötti pillanatért létezik. Ilyenkor még semmibe sem kerül egy másik méret, egy erősebb vonal vagy egy másik hely.'
              )}
            </p>
          </div>
          <div className="ab-days" aria-hidden="true">
            <div className="ab-day one">
              <b>1</b>
              <span>{T('day in most photos', 'nap a legtöbb fotón')}</span>
            </div>
            <div className="ab-day life">
              <b>18 262</b>
              <span>{T('days in fifty years', 'nap ötven év alatt')}</span>
            </div>
            <figure className="ab-days-img">
              <img src={IMG('hf_20261013_090713_9a5ab662-392f-41d6-9e0b-52da1e87bfe3', 900)} alt="" loading="lazy" />
            </figure>
          </div>
        </section>

        {/* mission statement */}
        <section className="ab-mission">
          <p className="ab-eyebrow">{T('Our mission', 'A küldetésünk')}</p>
          <blockquote>{T('We want people to love their tattoo in fifty years as much as on the first day.', 'Azt szeretnénk, hogy az emberek ötven év múlva is ugyanúgy szeressék a tetoválásukat, mint az első napon.')}</blockquote>
        </section>

        {/* beliefs */}
        <section className="ab-sec">
          <header className="ab-head">
            <p className="ab-eyebrow">{T('What we believe', 'Amiben hiszünk')}</p>
            <h2>{T('Four rules we don’t bend.', 'Négy szabály, amiből nem engedünk.')}</h2>
          </header>
          <ol className="ab-beliefs">
            {beliefs.map((b, i) => (
              <li key={b.h}>
                <span className="ab-n">{String(i + 1).padStart(2, '0')}</span>
                <span className="ab-ico">
                  <Ico k={b.i} />
                </span>
                <b>{b.h}</b>
                <p>{b.p}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* how it's made */}
        <section className="ab-sec">
          <header className="ab-head">
            <p className="ab-eyebrow">{T('How a preview is made', 'Hogyan készül egy előnézet')}</p>
            <h2>{T('What the AI takes into account.', 'Mit vesz figyelembe az MI.')}</h2>
            <p>
              {T(
                'Each preview starts from your photo and your design, then ages it stage by stage — every step continues from the one before, so changes build up the way they would on real skin.',
                'Minden előnézet a fotódból és a mintádból indul, majd lépésről lépésre öregíti – minden stádium az előzőből folytatódik, így a változások úgy adódnak össze, ahogy valódi bőrön.'
              )}
            </p>
          </header>
          <div className="ab-factors">
            {factors.map((f) => (
              <div key={f.h} className="ab-factor">
                <span className="ab-ico">
                  <Ico k={f.i} />
                </span>
                <b>{f.h}</b>
                <p>{f.p}</p>
              </div>
            ))}
          </div>
        </section>

        {/* promise vs. not */}
        <section className="ab-sec">
          <header className="ab-head">
            <p className="ab-eyebrow">{T('Straight talk', 'Egyenesen')}</p>
            <h2>{T('What InkAge is — and what it isn’t.', 'Mi az InkAge – és mi nem.')}</h2>
          </header>
          <div className="ab-is">
            <div className="yes">
              <b>{T('What we do', 'Amit vállalunk')}</b>
              <ul>
                <li>{T('Show your design on your own photo, fresh to 50 years', 'Megmutatjuk a mintádat a saját fotódon, frissen és 50 évig')}</li>
                <li>{T('Compare sizes, spots and line weights in minutes', 'Percek alatt összevetheted a méreteket, helyeket, vonalvastagságokat')}</li>
                <li>{T('Preview laser removal after 3, 6 and 10 sessions', 'Előnézetet adunk a lézeres eltávolításról 3, 6 és 10 kezelés után')}</li>
                <li>{T('Give you a PDF and links to take to your artist', 'PDF-et és linkeket adunk, amit elvihetsz a tetoválódhoz')}</li>
              </ul>
            </div>
            <div className="no">
              <b>{T('What we don’t', 'Amit nem')}</b>
              <ul>
                <li>{T('Measure your skin or give medical advice', 'Nem mérjük a bőröd, és nem adunk orvosi tanácsot')}</li>
                <li>{T('Guarantee how a real tattoo will age', 'Nem garantáljuk, hogyan öregszik egy valódi tetoválás')}</li>
                <li>{T('Replace your artist’s judgement', 'Nem helyettesítjük a tetoválód szakértelmét')}</li>
                <li>{T('Sell your photos or show you ads', 'Nem adjuk el a fotóidat, és nem mutatunk hirdetést')}</li>
              </ul>
            </div>
          </div>
        </section>

        {/* where we are */}
        <section className="ab-sec ab-now">
          <div>
            <p className="ab-eyebrow">{T('Where we are now', 'Hol tartunk most')}</p>
            <h2>{T('Public beta. Every feature open.', 'Nyilvános béta. Minden funkció elérhető.')}</h2>
            <p>
              {T(
                'While we learn what helps people most, every feature is open to everyone with an account. Ideas and bug reports go straight to the people building InkAge — you can write to us from the contact page or from Settings in the app.',
                'Amíg kiderítjük, mi segít a legtöbbet, minden funkció elérhető mindenkinek, akinek van fiókja. Az ötletek és hibajelentések egyenesen azokhoz jutnak, akik az InkAge-et építik – írhatsz a kapcsolat oldalon vagy az appban a Beállítások alatt.'
              )}
            </p>
            <div className="ab-now-btns">
              <Link href={`/kapcsolat${q}`} className="ab-btn dark">
                {T('Write to us', 'Írj nekünk')}
              </Link>
              <Link href={`/ingyenes-beta${q}`} className="ab-btn">
                {T('About the beta', 'A bétáról')}
              </Link>
            </div>
          </div>
          <ul className="ab-now-list">
            <li>
              <Ico k="gift" />
              <span>
                <b>{T('30 previews a month', 'Havi 30 előnézet')}</b>
                {T('All features, with your account.', 'Minden funkció, a fiókoddal.')}
              </span>
            </li>
            <li>
              <Ico k="globe" />
              <span>
                <b>{T('In 10 languages', '10 nyelven').replace('10', String((READY as string[]).length))}</b>
                {T('Switch any time from the menu.', 'Bármikor átválthatod a menüben.')}
              </span>
            </li>
            <li>
              <Ico k="phone" />
              <span>
                <b>{T('Runs in your browser', 'Böngészőben fut')}</b>
                {T('No download — or add it to your home screen.', 'Nem kell letölteni – vagy tedd ki a kezdőképernyőre.')}
              </span>
            </li>
            <li>
              <Ico k="shield" />
              <span>
                <b>{T('Private by default', 'Alapból privát')}</b>
                {T('Delete your account and data in one tap.', 'Egy koppintással törölheted a fiókod és az adataid.')}
              </span>
            </li>
          </ul>
        </section>
      </div>
    </InfoPage>
  );
}
