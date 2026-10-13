import type { Metadata } from 'next';
import { InfoPage, langOf, type InfoSec } from '../_info/InfoPage';

export const dynamic = 'force-dynamic';
export function generateMetadata({ searchParams }: { searchParams: { lang?: string } }): Metadata {
  const L = langOf(searchParams);
  return { title: L === 'hu' ? 'Rólunk – InkAge' : 'About – InkAge' };
}

export default function Page({ searchParams }: { searchParams: { lang?: string } }) {
  const L = langOf(searchParams);
  const T = (en: string, hu: string) => (L === 'hu' ? hu : en);
  const sections: InfoSec[] = [
    {
      h: T('What is InkAge?', 'Mi az InkAge?'),
      id: 'mi-az',
      icon: 'spark',
      ps: [
        T('InkAge shows a tattoo on a photo of your own body — fresh, healed, and at 10, 30 and 50 years. It runs in the browser, takes about a minute, and is free during the beta.', 'Az InkAge megmutat egy tetoválást a saját testedről készült fotón – frissen, gyógyultan, valamint 10, 30 és 50 év múlva. Böngészőben fut, nagyjából egy percig tart, és a béta alatt ingyenes.'),
        T('It exists for one moment: the time between “I love this design” and the chair. That is when a different size, a bolder line or another spot on the body costs nothing to change.', 'Egyetlen pillanatért létezik: azért az időért, ami a „imádom ezt a mintát” és a tetoválószék között telik el. Ilyenkor még semmibe sem kerül egy másik méret, egy erősebb vonal vagy egy másik testrész.'),
      ],
    },
    {
      h: T('Why we built it', 'Miért csináltuk'),
      icon: 'heart', img: 'hf_20261013_090713_9a5ab662-392f-41d6-9e0b-52da1e87bfe3',
      ps: [
        T('Almost every tattoo photo online shows the first day: sharp, dark, freshly moisturised. Almost nobody shows year ten or year thirty. Yet a tattoo is something you live with for decades.', 'Szinte minden tetoválásfotó a neten az első napot mutatja: éles, sötét, frissen bekrémezett. A tizedik vagy a harmincadik évet szinte senki nem mutatja. Pedig a tetoválással évtizedekig élsz együtt.'),
        T('!! We want people to love their tattoo in fifty years as much as on the first day.', '!! Azt szeretnénk, hogy az emberek ötven év múlva is ugyanúgy szeressék a tetoválásukat, mint az első napon.'),
      ],
    },
    {
      h: T('What we believe', 'Amiben hiszünk'),
      icon: 'check',
      ps: [
        T('- **Honest previews.** Every image is an AI estimate and we say so. We never promise how your skin will age.', '- **Őszinte előnézetek.** Minden kép MI-becslés, és ezt ki is mondjuk. Soha nem ígérjük meg, hogyan fog öregedni a bőröd.'),
        T('- **Artists matter.** InkAge helps you arrive at a consultation with a clearer idea. The craft, the needle and the judgement stay with your artist.', '- **A tetoválók számítanak.** Az InkAge abban segít, hogy tisztább elképzeléssel érkezz a konzultációra. A szakértelem, a tű és a döntés a tetoválódnál marad.'),
        T('- **Your photos are yours.** No advertising trackers, no third-party analytics, nothing public unless you share it.', '- **A fotóid a tieid.** Nincsenek hirdetési követők, nincs külső analitika, és semmi sem nyilvános, amíg meg nem osztod.'),
        T('- **No fake social proof.** You won’t find invented reviews or made-up user numbers here.', '- **Nincs hamis visszaigazolás.** Kitalált értékeléseket vagy felfújt felhasználószámokat itt nem fogsz találni.'),
      ],
    },
    {
      h: T('Where we are now', 'Hol tartunk most'),
      icon: 'clock',
      ps: [
        T('InkAge is in public beta. Everything is free while we learn what helps people most. Ideas and bug reports go straight to the people building it — the contact page is the fastest way to reach us.', 'Az InkAge nyilvános bétában van. Minden ingyenes, amíg kiderítjük, mi segít a legtöbbet. Az ötletek és hibajelentések egyenesen azokhoz jutnak, akik építik – a kapcsolat oldal a leggyorsabb út hozzánk.'),
      ],
    },
  ];
  return (
    <InfoPage
      lang={L}
      path="/rolunk"
      kicker={T('About', 'Rólunk')}
      title={T('Love it on day one. And in fifty years.', 'Szeresd az első napon. És ötven év múlva is.')}
      img="hf_20261013_090802_c2968625-4757-4c65-8bfd-d6c8e7ff7d3a"
      sections={sections}
      kickerIcon="heart"
      related={[
        { href: '/mi-az-inkage', t: T('What is InkAge?', 'Mi az InkAge?'), p: T('The product in two minutes.', 'A termék két percben.'), i: 'spark' },
        { href: '/kapcsolat', t: T('Contact', 'Kapcsolat'), p: T('Ideas, questions, bug reports.', 'Ötletek, kérdések, hibajelentések.'), i: 'mail' },
        { href: '/adatbiztonsag', t: T('Data security', 'Adatbiztonság'), p: T('How your photos are protected.', 'Így védjük a fotóidat.'), i: 'shield' },
      ]}
    />
  );
}
