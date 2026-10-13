import type { Metadata } from 'next';
import { InfoPage, langOf } from '../_info/InfoPage';
import { ContactForm } from './ContactForm';

export const dynamic = 'force-dynamic';
export function generateMetadata({ searchParams }: { searchParams: { lang?: string } }): Metadata {
  return { title: langOf(searchParams) === 'hu' ? 'Kapcsolat – InkAge' : 'Contact – InkAge' };
}

export default function Page({ searchParams }: { searchParams: { lang?: string } }) {
  const L = langOf(searchParams);
  const T = (en: string, hu: string) => (L === 'hu' ? hu : en);
  return (
    <InfoPage
      lang={L}
      path="/kapcsolat"
      kicker={T('Contact', 'Kapcsolat')}
      kickerIcon="mail"
      title={T('Write to us.', 'Írj nekünk.')}
      lede={T('A question, an idea, something that didn’t work — we read every message.', 'Kérdés, ötlet, valami, ami nem működött – minden üzenetet elolvasunk.')}
      cta={false}
      highlights={[
        { i: 'doc', h: T('Questions', 'Kérdések'), p: T('About previews, accuracy or your data.', 'Előnézetekről, pontosságról vagy az adataidról.') },
        { i: 'spark', h: T('Ideas', 'Ötletek'), p: T('Tell us what would help you decide.', 'Mondd el, mi segítene a döntésben.') },
        { i: 'shield', h: T('Bug reports', 'Hibajelentés'), p: T('Something broke? We’ll fix it.', 'Valami elromlott? Kijavítjuk.') },
      ]}
      related={[
        { href: '/gyik', t: T('FAQ', 'GYIK'), p: T('Maybe it’s already answered.', 'Lehet, hogy már van rá válasz.'), i: 'doc' },
        { href: '/fiok-torlese', t: T('Delete account', 'Fiók törlése'), p: T('Do it yourself in seconds.', 'Magad is megteheted pár másodperc alatt.'), i: 'trash' },
        { href: '/adatbiztonsag', t: T('Data security', 'Adatbiztonság'), p: T('How your photos are protected.', 'Így védjük a fotóidat.'), i: 'shield' },
      ]}
    >
      <section className="ip-sec">
        <div className="ip-sec-txt">
          <h2>
            <span className="ip-sec-n">✉</span>
            {T('Send a message', 'Üzenet küldése')}
          </h2>
          <ContactForm lang={L} />
        </div>
      </section>
    </InfoPage>
  );
}
