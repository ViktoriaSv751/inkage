import type { Metadata } from 'next';
import { InfoPage, langOf, type InfoSec } from '../_info/InfoPage';

export const dynamic = 'force-dynamic';
export function generateMetadata({ searchParams }: { searchParams: { lang?: string } }): Metadata {
  const L = langOf(searchParams);
  return { title: L === 'hu' ? 'Mi az InkAge? – InkAge' : 'What is InkAge? – InkAge', description: L === 'hu' ? 'Az InkAge megmutatja a tetoválásodat a saját bőrödön frissen és 50 év múlva.' : 'InkAge shows your tattoo on your own skin, fresh and 50 years later.' };
}

export default function Page({ searchParams }: { searchParams: { lang?: string } }) {
  const L = langOf(searchParams);
  const T = (en: string, hu: string) => (L === 'hu' ? hu : en);
  const sections: InfoSec[] = [
    {
      h: T('A preview of the next 50 years', 'Előnézet a következő 50 évről'),
      icon: 'clock',
      img: 'hf_20261013_090713_9a5ab662-392f-41d6-9e0b-52da1e87bfe3',
      ps: [
        T('InkAge puts a tattoo design on a photo of your own body and shows it at five moments: fresh, healed after a year, and at 10, 30 and 50 years.', 'Az InkAge egy tetoválásmintát tesz a saját testedről készült fotóra, és öt időpontban mutatja meg: frissen, egy év után gyógyultan, valamint 10, 30 és 50 év múlva.'),
        T('Every image keeps your skin tone, your lighting and the shape of your body, so you see your tattoo — not a stock model’s.', 'Minden kép megtartja a bőrtónusodat, a fényeidet és a tested formáját, így a saját tetoválásodat látod – nem egy modellét.'),
      ],
    },
    {
      h: T('Who it’s for', 'Kinek szól'),
      icon: 'user',
      ps: [T('Anyone between “I love this design” and the tattoo chair.', 'Mindenkinek, aki az „imádom ezt a mintát” és a tetoválószék között jár.')],
      cards: [
        { i: 'spark', h: T('First tattoo', 'Első tetoválás'), p: T('Try sizes and spots before you book.', 'Próbálj ki méreteket és helyeket foglalás előtt.') },
        { i: 'clock', h: T('Existing tattoos', 'Meglévő tetoválás'), p: T('See where your ink is heading.', 'Nézd meg, merre tart a tintád.') },
        { i: 'laser', h: T('Thinking of removal', 'Eltávolítás előtt'), p: T('Preview 3, 6 and 10 laser sessions.', 'Előnézet 3, 6 és 10 lézeres kezelés után.') },
        { i: 'heart', h: T('Tattoo artists', 'Tetoválóknak'), p: T('Show clients why bolder lasts.', 'Mutasd meg, miért tart tovább az erősebb vonal.') },
      ],
    },
    {
      h: T('What you get', 'Mit kapsz'),
      icon: 'gift',
      img: 'hf_20261013_090754_fed474a4-feac-40fa-928d-47ed6d6cef1a',
      ps: [
        T('- Realistic ageing images on your own photo', '- Valósághű öregedési képek a saját fotódon'),
        T('- A 0–100 longevity score with reasons', '- 0–100-as tartóssági pontszám, indoklással'),
        T('- “Make it last”: a sturdier redraw to compare', '- „Tedd tartóssá”: tartósabb átrajzolás összehasonlításhoz'),
        T('- Vote links, videos and a PDF for your artist', '- Szavazós linkek, videók és PDF a tetoválódnak'),
      ],
    },
    {
      h: T('What it isn’t', 'Mi nem'),
      icon: 'eye',
      ps: [
        T('It’s an AI estimate, not a measurement of your skin and not medical advice. Real results depend on your artist, ink, skin, sun and aftercare.', 'MI-becslés, nem a bőröd mérése és nem orvosi tanács. A valós eredmény a tetoválótól, a tintától, a bőrödtől, a naptól és az utókezeléstől függ.'),
        T('!! Your artist decides the details. InkAge helps you arrive with a clearer idea.', '!! A részletekről a tetoválód dönt. Az InkAge abban segít, hogy tisztább elképzeléssel érkezz.'),
      ],
    },
  ];
  return (
    <InfoPage
      lang={L}
      path="/mi-az-inkage"
      kicker={T('What is InkAge?', 'Mi az InkAge?')}
      title={T('Your tattoo, fifty years from now.', 'A tetoválásod, ötven év múlva.')}
      lede={T('A free web app that shows how a tattoo will look on your own skin over a lifetime — before it’s permanent.', 'Ingyenes webes alkalmazás, ami megmutatja, hogyan fog kinézni egy tetoválás a saját bőrödön egy életen át – mielőtt végleges lesz.')}
      img="hf_20261013_090637_00bc55f1-c4f6-4bb3-af84-c63dff9cd69b"
      sections={sections}
      highlights={[
        { i: 'clock', h: T('5 moments', '5 időpont'), p: T('Fresh, 1, 10, 30, 50 years.', 'Friss, 1, 10, 30, 50 év.') },
        { i: 'camera', h: T('Your own photo', 'A saját fotód'), p: T('Your skin tone, your light.', 'A bőrtónusod, a fényeid.') },
        { i: 'gift', h: T('Free in beta', 'Ingyenes a béta alatt'), p: T('No card, no trial timer.', 'Kártya és próbaidő nélkül.') },
      ]}
      related={[
        { href: '/hogyan-mukodik', t: T('How it works', 'Hogyan működik'), p: T('Five steps, about a minute.', 'Öt lépés, kb. egy perc.'), i: 'camera' },
        { href: '/funkciok', t: T('Features', 'Funkciók'), p: T('Everything InkAge can do.', 'Minden, amit az InkAge tud.'), i: 'spark' },
        { href: '/rolunk', t: T('About us', 'Rólunk'), p: T('Why we built it.', 'Miért csináltuk.'), i: 'heart' },
      ]}
    />
  );
}
