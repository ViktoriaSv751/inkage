import { tx } from '@/lib/tr';
import type { Metadata } from 'next';
import { InfoPage, langOf, type InfoSec } from '../../_info/InfoPage';
import { PUBLIC } from '@/lib/public-config';

/* GDPR Art. 28 data processing terms for the B2B studio/clinic subscriptions (2026-11-12).
   The studio is the controller of its guests' data, InkAge the processor. Sub-processors match /privacy and lib/ai/providers.ts
   (Gemini, OpenAI fallback). Not reviewed by a lawyer. */
export const dynamic = 'force-dynamic';
export function generateMetadata({ searchParams }: { searchParams: { lang?: string } }): Metadata {
  return {
    title: tx(langOf(searchParams), 'Data processing terms for studios and clinics – InkAge', 'Adatfeldolgozói feltételek szalonoknak és klinikáknak – InkAge'),
    description: tx(langOf(searchParams), 'How InkAge processes the photos and previews of studio and clinic guests as a processor under GDPR Article 28.', 'Hogyan kezeli az InkAge adatfeldolgozóként (GDPR 28. cikk) a szalonok és klinikák vendégeinek fotóit és előnézeteit.'),
  };
}

export default function Page({ searchParams }: { searchParams: { lang?: string } }) {
  const L = langOf(searchParams);
  const T = (en: string, hu: string) => tx(L, en, hu);
  const mail = PUBLIC.contactEmail;
  const reach = mail ? T(`by e-mail to ${mail} or through the contact page`, `e-mailben a ${mail} címen vagy a kapcsolat oldalon`) : T('through the contact page', 'a kapcsolat oldalon');
  const sections: InfoSec[] = [
    {
      h: T('Parties and scope', 'A felek és a feltételek hatálya'),
      ps: [
        T('These terms are the data processing agreement under Article 28 of the General Data Protection Regulation (GDPR, Regulation (EU) 2016/679) between the studio, clinic or other business that subscribes to InkAge or starts its trial (“the studio”) and the operator of InkAge: Sóti Viktória Vivien e.v., 2194 Tura, Hősök útja 21., Hungary, tax number 92541942-1-33 (“InkAge”).', 'Ezek a feltételek az általános adatvédelmi rendelet (GDPR, (EU) 2016/679 rendelet) 28. cikke szerinti adatfeldolgozási megállapodást tartalmazzák az InkAge-re előfizető vagy annak próbáját elindító szalon, klinika vagy más vállalkozás („a szalon”) és az InkAge üzemeltetője: Sóti Viktória Vivien e.v., 2194 Tura, Hősök útja 21., adószám: 92541942-1-33 („az InkAge”) között.'),
        T('They form part of the subscription contract (the section for studios and clinics in the terms of use) and apply from the moment the studio starts the trial or subscribes. Where these terms and the terms of use differ on personal data of guests, these terms prevail.', 'A feltételek az előfizetési szerződés (a felhasználási feltételek szalonoknak és klinikáknak szóló része) részét képezik, és a próba elindításától, illetve az előfizetéstől hatályosak. Ha a vendégek személyes adatait illetően ezek a feltételek és a felhasználási feltételek eltérnek, ezek a feltételek az irányadók.'),
      ],
    },
    {
      h: T('Roles', 'Szerepek'),
      ps: [
        T('- **The studio is the controller** of its guests’ personal data: it decides whose photo is taken and uploaded, for what consultation, and what is done with the previews.', '- **A szalon az adatkezelő** a vendégei személyes adatai tekintetében: ő dönti el, kinek a fotóját készíti el és tölti fel, milyen konzultációhoz, és mi történik az előnézetekkel.'),
        T('- **InkAge is the processor:** it processes these data only to provide the service and on the studio’s documented instructions. Using the service as offered (uploading, generating, saving, sharing and deleting previews, and the account settings) counts as the studio’s instructions. InkAge tells the studio if, in its opinion, an instruction would break data protection law.', '- **Az InkAge az adatfeldolgozó:** ezeket az adatokat csak a szolgáltatás nyújtásához és a szalon dokumentált utasítására kezeli. A szolgáltatás rendeltetésszerű használata (feltöltés, előnézet készítése, mentése, megosztása és törlése, valamint a fiókbeállítások) a szalon utasításának minősül. Az InkAge jelzi a szalonnak, ha megítélése szerint egy utasítás adatvédelmi jogszabályba ütközne.'),
        T('- For the studio’s own account data (staff names and e-mail addresses, business name, billing details, the subscription), InkAge is the controller under its privacy policy; these terms do not cover those data.', '- A szalon saját fiókadatai (a munkatársak neve és e-mail-címe, a vállalkozás neve, a számlázási adatok, az előfizetés) tekintetében az InkAge az adatkezelő az adatvédelmi tájékoztatója szerint; ezekre az adatokra ezek a feltételek nem vonatkoznak.'),
      ],
    },
    {
      h: T('Subject, purpose and data', 'Tárgy, cél és az adatok köre'),
      ps: [
        T('- **Purpose:** making AI previews on the studio’s instruction of how a tattoo could look on the guest’s skin today and as it ages, or after laser sessions; storing them in the studio’s account; and, if the studio chooses, sharing them with the guest by link.', '- **Cél:** a szalon utasítására MI-előnézetek készítése arról, hogyan nézhet ki egy tetoválás a vendég bőrén ma és az évek során, illetve lézeres kezelések után; ezek tárolása a szalon fiókjában; és ha a szalon úgy dönt, megosztásuk a vendéggel egy linken.'),
        T('- **Data subjects:** the studio’s guests, and the studio’s staff members who use the account.', '- **Érintettek:** a szalon vendégei, valamint a fiókot használó munkatársai.'),
        T('- **Data:** photos of the guest’s body part, the tattoo design or the existing tattoo, the previews made from them, an optional guest name or note the studio adds, and technical data of the use (time and number of previews, which staff member made them).', '- **Adatok:** a vendég testrészéről készült fotó, a tetoválásminta vagy a meglévő tetoválás, a belőlük készült előnézetek, a vendég neve vagy a szalon által hozzáírt jegyzet, ha megadják, valamint a használat technikai adatai (az előnézetek ideje és száma, melyik munkatárs készítette).'),
        T('- **Special categories:** the service is not meant for special categories of data. A body photo may still occasionally show something about health (for example a skin condition). The studio uploads only the area needed for the preview and is responsible for having an appropriate legal basis.', '- **Különleges adatok:** a szolgáltatás nem különleges adatok kezelésére szolgál. Egy testfotón ennek ellenére esetenként látszhat valami az egészségi állapotról (például bőrelváltozás). A szalon csak az előnézethez szükséges testrészt tölti fel, és felel a megfelelő jogalapért.'),
        T('- **Not done:** InkAge does not use guests’ photos or previews for advertising, does not sell them, does not use them to identify anyone, does not publish them in its public Explore feed on its own and does not train its own AI models on them.', '- **Amit nem teszünk:** az InkAge a vendégek fotóit és előnézeteit nem használja hirdetésre, nem adja el, nem használja személyazonosításra, saját döntéséből nem teszi közzé a nyilvános Felfedezés falon, és nem tanít rajtuk saját MI-modellt.'),
      ],
    },
    {
      h: T('Duration and deletion', 'Időtartam és törlés'),
      ps: [
        T('Processing lasts as long as the studio’s account exists. The studio can delete any photo or preview at any time in the account; deleted items first go to Recently deleted and are removed for good when it is emptied. Deleting the account removes all of them at once.', 'Az adatkezelés a szalon fiókjának fennállásáig tart. A szalon bármikor törölhet bármely fotót vagy előnézetet a fiókjában; a törölt elemek először a Nemrég törölt mappába kerülnek, és annak ürítésekor véglegesen törlődnek. A fiók törlése mindet egyszerre eltávolítja.'),
        T('- **Automatic deletion:** in the account settings the studio can choose to have guests’ photos and previews deleted automatically 30 or 90 days after they were made.', '- **Automatikus törlés:** a szalon a fiók beállításaiban választhatja, hogy a vendégek fotói és előnézetei a készítésük után 30 vagy 90 nappal automatikusan törlődjenek.'),
        T('- **On request:** if the studio asks in writing, InkAge deletes or hands over the guests’ data within 30 days, also after the subscription has ended.', '- **Kérésre:** ha a szalon írásban kéri, az InkAge 30 napon belül törli vagy átadja a vendégek adatait, az előfizetés megszűnése után is.'),
        T('- After the subscription ends the account and its data remain until the studio deletes them, so previews already made stay usable. Copies in our providers’ backups disappear when those backups expire. A shared link stops working when it is closed or the preview is deleted.', '- Az előfizetés megszűnése után a fiók és az adatai megmaradnak, amíg a szalon nem törli őket, így a már elkészült előnézetek használhatók maradnak. A szolgáltatóink biztonsági mentéseiben lévő másolatok a mentések lejártakor tűnnek el. A megosztott link a lezárásakor vagy az előnézet törlésekor megszűnik.'),
      ],
    },
    {
      h: T('Sub-processors', 'Alvállalkozó adatfeldolgozók'),
      ps: [
        T('The studio gives general authorisation for InkAge to use these sub-processors. Each processes data only for the service and under data processing terms with obligations at least as protective as these:', 'A szalon általános felhatalmazást ad arra, hogy az InkAge az alábbi alvállalkozó adatfeldolgozókat igénybe vegye. Mindegyik csak a szolgáltatáshoz, és legalább ilyen védelmet nyújtó adatfeldolgozási feltételek mellett kezeli az adatokat:'),
        T('- **Supabase** – database, sign-in and file storage of photos and previews (EU region)', '- **Supabase** – adatbázis, belépés, a fotók és előnézetek tárhelye (EU-régió)'),
        T('- **Vercel** – hosting of the website and the app; the photos pass through it while a preview is made', '- **Vercel** – a weboldal és az app tárhelye; az előnézet készítésekor a fotók rajta haladnak át'),
        T('- **Google (Gemini API)** – checking the photo and making the preview; **OpenAI** as a backup when Gemini is unavailable. They may keep data for a limited time for abuse monitoring under their own terms.', '- **Google (Gemini API)** – a fotó ellenőrzése és az előnézet elkészítése; **OpenAI** tartalékként, ha a Gemini nem elérhető. Saját feltételeik szerint visszaélés-szűrés céljából korlátozott ideig megőrizhetik az adatokat.'),
        T('- **Resend** – sending service e-mails to the studio’s staff (for example when a preview is ready)', '- **Resend** – szolgáltatási e-mailek küldése a szalon munkatársainak (például amikor elkészült egy előnézet)'),
        T('**Stripe** (card payments) and **Billingo** (invoices) receive only the studio’s billing data, never guests’ photos or previews; for those InkAge is the controller.', 'A **Stripe** (kártyás fizetés) és a **Billingo** (számlázás) csak a szalon számlázási adatait kapja meg, a vendégek fotóit és előnézeteit soha; ezekért az InkAge az adatkezelő.'),
        T('InkAge announces a new or replaced sub-processor on this page and by e-mail to the subscribers at least 30 days before it starts. If the studio objects for a well-founded data protection reason and we cannot resolve it, the studio may cancel the subscription before the change and we refund the unused part of the period already paid.', 'Új vagy lecserélt alvállalkozó adatfeldolgozót az InkAge ezen az oldalon és e-mailben, legalább 30 nappal az igénybevétel előtt jelez az előfizetőknek. Ha a szalon megalapozott adatvédelmi okból tiltakozik, és ezt nem tudjuk megoldani, a szalon a változás előtt lemondhatja az előfizetést, és a már kifizetett időszak fel nem használt részét visszatérítjük.'),
      ],
    },
    {
      h: T('International transfers', 'Nemzetközi adattovábbítás'),
      ps: [T('Some sub-processors (Vercel, Google, OpenAI, Resend) are based in the United States. Transfers rely on the EU–US Data Privacy Framework or the EU standard contractual clauses.', 'Egyes alvállalkozó adatfeldolgozók (Vercel, Google, OpenAI, Resend) az Egyesült Államokban működnek. Az adattovábbítás az EU–USA adatvédelmi keretrendszeren vagy az EU általános szerződési feltételein (standard contractual clauses) alapul.')],
    },
    {
      h: T('Security and confidentiality', 'Biztonság és titoktartás'),
      ps: [
        T('- All traffic is encrypted with HTTPS.', '- Minden adatforgalom HTTPS-titkosítással megy.'),
        T('- Row-level security in the database: every request is checked against who is signed in, so a studio’s photos and previews can be opened only from that studio’s account, unless the studio shares a link.', '- Sorszintű jogosultság az adatbázisban: minden kérésnél ellenőrizzük, ki van bejelentkezve, így egy szalon fotói és előnézetei csak az ő fiókjából nyithatók meg, hacsak a szalon meg nem oszt egy linket.'),
        T('- Server keys never reach the browser; sensitive actions run on the server.', '- A szerverkulcsok soha nem jutnak el a böngészőbe; az érzékeny műveletek a szerveren futnak.'),
        T('- Photos of minors and nude images are refused automatically.', '- A kiskorúakat ábrázoló és a meztelen képeket automatikusan elutasítjuk.'),
        T('- Only the operator of InkAge has administrative access, is bound by confidentiality, and looks at guests’ data only when needed to fix a fault, investigate abuse or meet a legal obligation.', '- Adminisztrátori hozzáférése csak az InkAge üzemeltetőjének van, titoktartási kötelezettség terheli, és a vendégek adataiba csak hibaelhárításhoz, visszaélés kivizsgálásához vagy jogszabályi kötelezettség teljesítéséhez tekint bele.'),
        T('- The studio keeps its own sign-ins safe, gives access only to its own staff, and removes people who leave.', '- A szalon gondoskodik a saját belépései biztonságáról, csak a saját munkatársainak ad hozzáférést, és eltávolítja a távozókat.'),
      ],
    },
    {
      h: T('Personal data breach', 'Adatvédelmi incidens'),
      ps: [T('If InkAge becomes aware of a personal data breach affecting guests’ data, it notifies the studio without undue delay by e-mail to the account address, with what is known about the nature of the breach, the data and people affected, its likely consequences and the measures taken, and keeps the studio updated. Notifying the authority and the guests, where required, is the studio’s task as controller; InkAge helps with the information it has.', 'Ha az InkAge vendégadatokat érintő adatvédelmi incidensről szerez tudomást, indokolatlan késedelem nélkül e-mailben értesíti a szalont a fiók címén, megadva, amit az incidens jellegéről, az érintett adatokról és személyekről, a valószínű következményekről és a megtett intézkedésekről tud, és folyamatosan tájékoztatja. A hatóság és a vendégek értesítése, ahol szükséges, a szalon mint adatkezelő feladata; az InkAge ebben a rendelkezésére álló információkkal segít.')],
    },
    {
      h: T('Assistance', 'Közreműködés'),
      ps: [T('InkAge helps the studio, as far as it reasonably can, to answer guests who exercise their rights (access, correction, deletion, restriction, objection, portability) – most of these the studio can do itself in the account – and to meet its obligations on security, breach notification and data protection impact assessments. If a guest contacts InkAge directly about data processed for a studio, InkAge forwards the request to the studio and does not answer it on its own, unless the law requires.', 'Az InkAge az észszerűen elvárható mértékben segít a szalonnak a jogaikat gyakorló vendégek kérelmeinek megválaszolásában (hozzáférés, helyesbítés, törlés, korlátozás, tiltakozás, adathordozhatóság) – ezek többségét a szalon maga is elvégezheti a fiókban –, valamint a biztonsággal, az incidensek bejelentésével és az adatvédelmi hatásvizsgálattal kapcsolatos kötelezettségei teljesítésében. Ha egy vendég egy szalon számára kezelt adatai miatt közvetlenül az InkAge-hez fordul, az InkAge a kérelmet továbbítja a szalonnak, és jogszabályi kötelezettség hiányában maga nem válaszol rá.')],
    },
    {
      h: T('Audit', 'Ellenőrzés'),
      ps: [T(`On request InkAge gives the studio the information needed to show that these terms are kept: this page, the privacy policy, written answers to the studio’s questions and, where available, the sub-processors’ certifications and reports. An on-site inspection is possible only where the law requires it, at a time agreed in advance and at the studio’s cost. Questions: ${reach}.`, `Az InkAge kérésre átadja a szalonnak azokat az információkat, amelyek igazolják, hogy e feltételeket betartja: ezt az oldalt, az adatvédelmi tájékoztatót, írásos válaszokat a szalon kérdéseire, és ahol elérhetők, az alvállalkozó adatfeldolgozók tanúsítványait és jelentéseit. Helyszíni ellenőrzésre csak ott van mód, ahol jogszabály előírja, előre egyeztetett időpontban és a szalon költségére. Kérdések: ${reach}.`)],
    },
    {
      h: T('The studio’s obligations', 'A szalon kötelezettségei'),
      ps: [T('The studio makes sure it has a legal basis for each guest’s data (usually the guest’s consent before the photo is taken), tells its guests how their data are processed and that the previews are AI illustrations, and gives only lawful instructions. A sample consent form the studio can print or show is at /szalonoknak/hozzajarulas.', 'A szalon gondoskodik arról, hogy minden vendég adatához legyen jogalapja (jellemzően a vendég hozzájárulása a fotó elkészítése előtt), tájékoztatja a vendégeit az adataik kezeléséről és arról, hogy az előnézetek MI-illusztrációk, és csak jogszerű utasítást ad. A szalon által kinyomtatható vagy megmutatható hozzájárulási minta: /szalonoknak/hozzajarulas.')],
    },
    {
      h: T('Liability and governing law', 'Felelősség és irányadó jog'),
      ps: [T('Liability between the parties follows Article 82 GDPR and the liability rules of the terms of use for studios and clinics. Hungarian law applies.', 'A felek közötti felelősségre a GDPR 82. cikke és a felhasználási feltételek szalonoknak és klinikáknak szóló részének felelősségi szabályai az irányadók. A magyar jog az irányadó.')],
    },
  ];
  return (
    <InfoPage
      lang={L}
      path="/szalonoknak/adatfeldolgozas"
      kicker={T('For studios and clinics', 'Szalonoknak és klinikáknak')}
      kickerIcon="shield"
      title={T('Data processing terms', 'Adatfeldolgozói feltételek')}
      lede={T('How InkAge handles your guests’ photos and previews on your behalf, as your processor under GDPR Article 28.', 'Hogyan kezeli az InkAge a nevedben a vendégeid fotóit és előnézeteit, adatfeldolgozóként, a GDPR 28. cikke szerint.')}
      sections={sections}
      updated={T('12 November 2026', '2026. november 12.')}
      toc
      cta={false}
      related={[
        { href: '/terms', t: T('Terms for studios', 'ÁSZF szalonoknak'), p: T('Plans, renewal, cancellation.', 'Csomagok, megújulás, lemondás.'), i: 'scale' },
        { href: '/szalonoknak/hozzajarulas', t: T('Guest consent form', 'Vendég-hozzájárulás minta'), p: T('Print it or show it on screen.', 'Nyomtasd ki vagy mutasd meg a képernyőn.'), i: 'doc' },
        { href: '/privacy', t: T('Privacy policy', 'Adatvédelem'), p: T('What we store and why.', 'Mit tárolunk és miért.'), i: 'lock' },
      ]}
    />
  );
}
