import { tx, type Lang } from '@/lib/tr';
import { B2B, B2B_TOPUP, B2B_TRIAL, huf } from '@/lib/b2b';

/* Questions studio owners ask before they try (2026-11-12). Also feeds the FAQPage structured data. */
export function faqItems(L: Lang) {
  const T = (en: string, hu: string) => tx(L, en, hu);
  return [
    {
      q: T('How many artists can use one plan?', 'Hány tetováló használhatja egy csomagot?'),
      a: T(
        `Szalon is one login. Szalon Pro and Klinika: up to ${B2B.b2b_pro.seats} people, each with their own sign-in, sharing the plan's previews; the owner sees who used how many.`,
        `A Szalon egy belépés. A Szalon Pro és a Klinika: akár ${B2B.b2b_pro.seats} munkatárs, mindenki a saját belépésével, közös előnézet-kerettel; a tulajdonos látja, ki mennyit használt.`
      ),
    },
    {
      q: T('What counts as one preview?', 'Mi számít egy előnézetnek?'),
      a: T(
        'One design on one photo, with every stage: today, 1, 10, 30 and 50 years, and the laser series after 3, 6 and 10 sessions.',
        'Egy minta egy fotón, minden állapottal együtt: ma, 1, 10, 30 és 50 év, valamint a lézeres sorozat 3, 6 és 10 kezelés után.'
      ),
    },
    {
      q: T('What happens to unused previews?', 'Mi lesz a fel nem használt előnézetekkel?'),
      a: T(
        'They carry over to the next month and stay usable after you cancel, as long as the account exists. The trial is the exception: after 14 days only the unused trial previews expire.',
        'Átkerülnek a következő hónapra, és lemondás után is használhatók, amíg a fiók létezik. Kivétel a próba: 14 nap után a fel nem használt próba-előnézetek elvesznek.'
      ),
    },
    {
      q: T('How does the trial work?', 'Hogyan működik a próba?'),
      a: T(
        `${B2B_TRIAL.n} previews for ${B2B_TRIAL.days} days, no card. It ends by itself; nothing is charged. Subscribe during the trial and the trial previews you have left stay with you.`,
        `${B2B_TRIAL.n} előnézet ${B2B_TRIAL.days} napra, kártya nélkül. Magától lejár, semmit nem terhelünk. Ha a próba alatt előfizetsz, a megmaradt próba-előnézetek is megmaradnak.`
      ),
    },
    {
      q: T('How do I cancel or change plan?', 'Hogyan mondhatom le vagy válthatok csomagot?'),
      a: T(
        'On this page: Manage subscription opens the Stripe portal, where you cancel in two clicks (it runs until the end of the paid period). A plan change starts at the next renewal.',
        'Ezen az oldalon: az Előfizetés kezelése a Stripe-portált nyitja meg, ahol két kattintással lemondhatod (a kifizetett időszak végéig tart). A csomagváltás a következő megújulástól él.'
      ),
    },
    {
      q: T('What if a month is busier than usual?', 'Mi van, ha egy hónap forgalmasabb?'),
      a: T(`Buy a top-up: +${B2B_TOPUP.n} previews for ${huf(B2B_TOPUP.huf)}, one-time, without changing plan.`, `Vegyél kiegészítő csomagot: +${B2B_TOPUP.n} előnézet ${huf(B2B_TOPUP.huf)}-ért, egyszeri, csomagváltás nélkül.`),
    },
    {
      q: T('Do I get an invoice?', 'Kapok számlát?'),
      a: T(
        'Yes, an e-invoice by e-mail for every payment, in the company name and with the tax number you give before paying. The seller is VAT-exempt (alanyi adómentes), so there is no VAT on it.',
        'Igen, minden fizetésről e-számlát e-mailben, a fizetés előtt megadott cégnévre és adószámmal. Az eladó alanyi adómentes, ezért áfa nincs rajta.'
      ),
    },
    {
      q: T('Where do the guests’ photos go?', 'Hová kerülnek a vendégek fotói?'),
      a: T(
        'Into your account only, never public. We process them only to make the previews. You can delete them any time or set automatic deletion after 30 or 90 days. Details in the data processing terms.',
        'Csak a fiókodba, sosem nyilvánosan. Csak az előnézet elkészítéséhez dolgozzuk fel őket. Bármikor törölheted, vagy beállíthatod az automatikus törlést 30 vagy 90 nap után. Részletek az adatfeldolgozói feltételekben.'
      ),
    },
    {
      q: T('Does it work on a tablet at the counter?', 'Működik tableten a pultnál?'),
      a: T('Yes, in the browser or the iPhone / Android app, with the same account. The camera opens straight away.', 'Igen, böngészőben vagy az iPhone / Android appban, ugyanazzal a fiókkal. A kamera rögtön megnyílik.'),
    },
    {
      q: T('Is the preview exactly how the tattoo will look?', 'Pontosan így fog kinézni a tetoválás?'),
      a: T(
        'No one can promise that. It is an AI illustration of typical aging (or typical fading with laser), on the guest’s own photo. It helps the conversation; the artist’s and the doctor’s judgement stays the decisive one.',
        'Ezt senki nem ígérheti. Ez MI-illusztráció a jellemző öregedésről (vagy a lézeres halványodásról), a vendég saját fotóján. A beszélgetést segíti; a döntő szó a tetoválóé és az orvosé marad.'
      ),
    },
  ];
}

export function B2BFaq({ lang }: { lang: Lang }) {
  const items = faqItems(lang);
  return (
    <section className="b2b-faq" id="gyik">
      <h2>{tx(lang, 'Questions studios ask', 'Gyakori kérdések szalonoktól')}</h2>
      {items.map((f) => (
        <details key={f.q}>
          <summary>{f.q}</summary>
          <p>{f.a}</p>
        </details>
      ))}
    </section>
  );
}
