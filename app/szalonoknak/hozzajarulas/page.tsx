import { tx, qOf } from '@/lib/tr';
import type { Metadata } from 'next';
import { langOf } from '../../_info/InfoPage';
import { PrintButton } from './PrintButton';
import './hozzajarulas.css';

/* Sample guest consent form for studios and clinics (2026-11-12): print it or show it on screen. A template, not reviewed by a lawyer. */
export const dynamic = 'force-dynamic';
export function generateMetadata({ searchParams }: { searchParams: { lang?: string } }): Metadata {
  return {
    title: tx(langOf(searchParams), 'Guest consent form (sample) – InkAge for studios', 'Vendég-hozzájárulás (minta) – InkAge szalonoknak'),
    description: tx(langOf(searchParams), 'A short consent form a tattoo studio or laser clinic can print before making an AI preview of a guest’s tattoo.', 'Rövid hozzájárulási nyilatkozat, amelyet a szalon vagy klinika kinyomtathat, mielőtt MI-előnézetet készít a vendég tetoválásáról.'),
  };
}

export default function Page({ searchParams }: { searchParams: { lang?: string } }) {
  const L = langOf(searchParams);
  const T = (en: string, hu: string) => tx(L, en, hu);
  const Field = ({ label }: { label: string }) => (
    <div className="hz-field">
      <span>{label}</span>
      <i />
    </div>
  );
  const Check = ({ children }: { children: string }) => (
    <p className="hz-check">
      <b aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
  return (
    <main className="hz-page" lang={L}>
      <div className="hz-bar">
        <nav>
          <a href={`/szalonoknak${qOf(L)}`}>← InkAge {T('for studios', 'szalonoknak')}</a>
          <a href={`/szalonoknak/adatfeldolgozas${qOf(L)}`}>{T('Data processing terms', 'Adatfeldolgozói feltételek')}</a>
          <a href={L === 'en' ? '/szalonoknak/hozzajarulas' : '/szalonoknak/hozzajarulas?lang=en'}>{L === 'en' ? 'Magyarul' : 'English'}</a>
        </nav>
        <PrintButton label={T('Print', 'Nyomtatás')} />
      </div>

      <article className="hz-sheet">
        <h1>{T('Consent to a tattoo preview photo', 'Hozzájárulás tetoválás-előnézet fotóhoz')}</h1>
        <p className="hz-sub">{T('Sample form. The studio may adapt it to its own practice.', 'Minta. A szalon a saját gyakorlatához igazíthatja.')}</p>

        <Field label={T('Studio / clinic', 'Szalon / klinika')} />
        <Field label={T('Guest’s name', 'Vendég neve')} />

        <h2>{T('What the photo is used for', 'Mire használjuk a fotót')}</h2>
        <p>{T('The studio takes a photo of the body part concerned and uses the InkAge service to make previews of how the planned tattoo could look today and in later years, or how an existing tattoo could look after laser sessions. The photo and the design are processed by InkAge and the AI providers it uses only to make these previews, on the studio’s behalf. They are not used for advertising and not made public.', 'A szalon fotót készít az érintett testrészről, és az InkAge szolgáltatással előnézeteket készít arról, hogyan nézhet ki a tervezett tetoválás ma és az évek múlásával, illetve egy meglévő tetoválás lézeres kezelések után. A fotót és a mintát az InkAge és az általa igénybe vett MI-szolgáltatók csak ezeknek az előnézeteknek az elkészítéséhez, a szalon megbízásából kezelik. Hirdetésre nem használjuk, és nem tesszük nyilvánossá.')}</p>

        <h2>{T('The previews are AI illustrations', 'Az előnézetek MI-illusztrációk')}</h2>
        <p>{T('The previews are made by an artificial intelligence model. They show a possible appearance only; they are not a medical or professional opinion and not a promise of how the tattoo will heal, age or fade. With laser removal the number of sessions needed and the result vary from person to person.', 'Az előnézeteket mesterséges intelligencia készíti. Csak egy lehetséges megjelenést mutatnak; nem orvosi vagy szakmai vélemények, és nem ígéretek arra, hogyan gyógyul, öregszik vagy halványul a tetoválás. Lézeres eltávolításnál a szükséges kezelések száma és az eredmény személyenként eltér.')}</p>

        <h2>{T('Keeping and deleting', 'Megőrzés és törlés')}</h2>
        <p>{T('The studio keeps the photo and the previews only as long as needed for the consultation and the tattoo or treatment, and deletes them if I ask. I can withdraw this consent at any time by telling the studio; this does not affect what was done before.', 'A szalon a fotót és az előnézeteket csak a konzultációhoz és a tetováláshoz vagy kezeléshez szükséges ideig őrzi meg, és kérésemre törli. A hozzájárulásomat bármikor visszavonhatom a szalonnál; ez nem érinti a visszavonás előtti felhasználást.')}</p>
        <Field label={T('Deleted at the latest after', 'Legkésőbb törlés')} />

        <h2>{T('I declare and agree', 'Kijelentem és hozzájárulok')}</h2>
        <Check>{T('I am at least 18 years old.', 'Elmúltam 18 éves.')}</Check>
        <Check>{T('I agree that the studio takes a photo of my body part and makes AI previews from it as described above.', 'Hozzájárulok, hogy a szalon fotót készítsen a testrészemről, és abból a fent leírt módon MI-előnézeteket készítsen.')}</Check>
        <Check>{T('I understand that the previews are AI illustrations, not a guarantee.', 'Tudomásul veszem, hogy az előnézetek MI-illusztrációk, nem garanciák.')}</Check>
        <Check>{T('I would like to receive the previews by link (optional).', 'Szeretném linken megkapni az előnézeteket (nem kötelező).')}</Check>
        <Field label={T('E-mail or phone for the link', 'E-mail vagy telefon a linkhez')} />

        <div className="hz-sign">
          <div>{T('Place and date', 'Hely és dátum')}</div>
          <div>{T('Guest’s signature', 'A vendég aláírása')}</div>
          <div>{T('Name of the studio’s representative', 'A szalon képviselőjének neve')}</div>
          <div>{T('Studio’s signature', 'A szalon aláírása')}</div>
        </div>

        <p className="hz-foot">{T('The studio is responsible for the processing of the guest’s data (controller); InkAge processes them on the studio’s behalf. Details: inkage.app/szalonoknak/adatfeldolgozas', 'A vendég adatainak kezeléséért a szalon felel (adatkezelő); az InkAge a szalon megbízásából, adatfeldolgozóként kezeli őket. Részletek: inkage.app/szalonoknak/adatfeldolgozas')}</p>
      </article>
    </main>
  );
}
