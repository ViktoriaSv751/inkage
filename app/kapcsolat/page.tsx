import type { Metadata } from 'next';
import Link from 'next/link';
import { InfoPage, langOf } from '../_info/InfoPage';
import { ContactForm } from './ContactForm';

export const dynamic = 'force-dynamic';
export function generateMetadata({ searchParams }: { searchParams: { lang?: string } }): Metadata {
  const L = langOf(searchParams);
  return { title: L === 'hu' ? 'Kapcsolat – InkAge' : 'Contact – InkAge' };
}

export default function Page({ searchParams }: { searchParams: { lang?: string } }) {
  const L = langOf(searchParams);
  const T = (en: string, hu: string) => (L === 'hu' ? hu : en);
  const q = L === 'en' ? '?lang=en' : '';
  return (
    <InfoPage lang={L} path="/kapcsolat" kicker={T('Contact', 'Kapcsolat')} title={T('Write to us.', 'Írj nekünk.')} lede={T('A question, an idea, something that didn’t work — we read every message.', 'Kérdés, ötlet, valami, ami nem működött – minden üzenetet elolvasunk.')} cta={false}>
      <section className="ip-sec">
        <ContactForm lang={L} />
      </section>
      <section className="ip-sec">
        <h2>{T('Maybe it’s already answered', 'Lehet, hogy már van rá válasz')}</h2>
        <div className="ip-cards">
          <Link className="ip-card" href={`/gyik${q}`}>
            <b>{T('FAQ', 'GYIK')}</b>
            <p>{T('Pricing, photos, accuracy and privacy.', 'Árak, fotók, pontosság és adatvédelem.')}</p>
          </Link>
          <Link className="ip-card" href={`/fiok-torlese${q}`}>
            <b>{T('Delete my account', 'Fiókom törlése')}</b>
            <p>{T('You can do it yourself in the app, in seconds.', 'Magad is megteheted az appban, pár másodperc alatt.')}</p>
          </Link>
        </div>
      </section>
    </InfoPage>
  );
}
