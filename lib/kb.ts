// Knowledge base extras: pictures, categories, dates and short FAQs for every guide.
import { Article, ARTICLES } from './articles';

export const IMG = (f: string, w = 1200) => `/api/lib-img?f=${f}.png&w=${w}`;

export const KB_HERO = 'hf_20261013_090802_c2968625-4757-4c65-8bfd-d6c8e7ff7d3a';
export const KB_STILL = 'hf_20261013_090802_e242c395-fb5f-4641-9966-35e791e242a1';

type L2 = { en: string; hu: string };
export type KbMeta = {
  img: string;
  img2: string;
  cap2: L2;
  date: string; // ISO
  faq: { q: L2; a: L2 }[];
};

export const KB: Record<string, KbMeta> = {
  'how-tattoos-age': {
    img: 'hf_20261013_090637_00bc55f1-c4f6-4bb3-af84-c63dff9cd69b',
    img2: 'hf_20261013_090713_9a5ab662-392f-41d6-9e0b-52da1e87bfe3',
    cap2: { en: 'Ink in skin behaves a little like ink in water: very slowly, it spreads outwards.', hu: 'A tinta a bőrben kicsit úgy viselkedik, mint a vízben: nagyon lassan, de kifelé terül.' },
    date: '2026-10-12',
    faq: [
      { q: { en: 'Does every tattoo blur eventually?', hu: 'Minden tetoválás elmosódik egyszer?' }, a: { en: 'Every tattoo softens a little. Bold lines with enough space between them stay readable for decades; very fine, tightly packed details blur first.', hu: 'Minden tetoválás lágyul valamennyit. A vastag, elég térközzel húzott vonalak évtizedekig olvashatók maradnak; a nagyon finom, sűrű részletek mosódnak el először.' } },
      { q: { en: 'Can I slow it down?', hu: 'Lassítható a folyamat?' }, a: { en: 'Yes: sun protection (SPF 50), good aftercare in the first weeks and a sensible size make the biggest difference.', hu: 'Igen: a fényvédelem (50-es faktor), a jó utókezelés az első hetekben és az észszerű méret számít a legtöbbet.' } },
    ],
  },
  'fine-line-tattoos-aging': {
    img: 'hf_20261013_090635_ce1ed5c5-ee91-427e-8b5d-df3745b24bcd',
    img2: 'hf_20261013_090712_871c7ded-ebc4-4b71-9793-726037d5c35e',
    cap2: { en: 'Up close, the thinnest lines are the first to spread and lose their edge.', hu: 'Közelről nézve a legvékonyabb vonalak terülnek szét és veszítik el először az élüket.' },
    date: '2026-10-12',
    faq: [
      { q: { en: 'How long does a fine line tattoo stay crisp?', hu: 'Meddig marad éles egy fine line tetoválás?' }, a: { en: 'Often 5–10 years before softening is noticeable, depending on size, placement and sun. Larger pieces with more space hold up much longer.', hu: 'Gyakran 5–10 év, mire a lágyulás feltűnik – a mérettől, a helytől és a naptól függően. A nagyobb, levegősebb minták sokkal tovább tartanak.' } },
      { q: { en: 'Is a fine line tattoo a bad idea?', hu: 'Rossz ötlet a fine line tetoválás?' }, a: { en: 'No — just give it room. Ask for slightly bolder key lines and fewer tiny details, and check the 30-year preview before you book.', hu: 'Nem – csak adj neki helyet. Kérj kicsit erősebb fő vonalakat és kevesebb apró részletet, és foglalás előtt nézd meg a 30 éves előnézetet.' } },
    ],
  },
  'best-placement-for-tattoo-longevity': {
    img: 'hf_20261013_090636_a47c7837-fee2-4f58-a10b-ebfde043d99f',
    img2: 'hf_20261013_090712_b883017e-63c7-4890-9ffa-f39fc8b2eb96',
    cap2: { en: 'Ankles, feet and hands rub against shoes and everything we touch, so they fade faster.', hu: 'A boka, a lábfej és a kéz folyamatosan súrlódik, ezért gyorsabban fakul.' },
    date: '2026-10-12',
    faq: [
      { q: { en: 'Which places age best?', hu: 'Mely helyek öregszenek a legszebben?' }, a: { en: 'Upper back, shoulder blade, upper arm and outer thigh: little sun, little friction and stable skin.', hu: 'A hát felső része, a lapocka, a felkar és a comb külső oldala: kevés nap, kevés súrlódás és stabil bőr.' } },
      { q: { en: 'And which fade fastest?', hu: 'És melyek fakulnak a leggyorsabban?' }, a: { en: 'Fingers, palms, sides of the hands and feet, and lips.', hu: 'Az ujjak, a tenyér, a kéz és a láb oldala, valamint az ajak.' } },
    ],
  },
  'tattoo-aftercare-sun-protection': {
    img: 'hf_20261013_090704_eeabc335-2a0b-4d50-9b73-5f2f90bc233d',
    img2: 'hf_20261013_090723_d4ecb887-821e-4591-9a40-84e016274e42',
    cap2: { en: 'In the first weeks: clean hands, a thin layer of unscented balm, and patience.', hu: 'Az első hetekben: tiszta kéz, vékony réteg illatmentes krém és türelem.' },
    date: '2026-10-12',
    faq: [
      { q: { en: 'When can I put sunscreen on a new tattoo?', hu: 'Mikor kenhetek fényvédőt az új tetoválásra?' }, a: { en: 'Once it has fully healed and stopped flaking, usually after 3–4 weeks. Until then, keep it covered with clothing and out of the sun.', hu: 'Ha teljesen begyógyult és már nem hámlik, általában 3–4 hét után. Addig ruhával takard, és tartsd távol a naptól.' } },
      { q: { en: 'Which SPF should I use?', hu: 'Milyen faktorú fényvédőt használjak?' }, a: { en: 'A broad-spectrum SPF 50, reapplied every two hours in strong sun.', hu: 'Széles spektrumú, 50-es faktort, erős napon kétóránként újrakenve.' } },
    ],
  },
  'tattoo-size-guide': {
    img: 'hf_20261013_090636_566332b2-a899-482d-ae43-584585735377',
    img2: 'hf_20261013_090724_86d5fdc4-909f-468d-af52-bf30295690da',
    cap2: { en: 'The simplest test: print the design at the planned size and hold it against your skin.', hu: 'A legegyszerűbb próba: nyomtasd ki a mintát a tervezett méretben, és tartsd a bőrödhöz.' },
    date: '2026-10-12',
    faq: [
      { q: { en: 'What is the smallest size that still ages well?', hu: 'Mi a legkisebb méret, ami még szépen öregszik?' }, a: { en: 'It depends on the detail: a simple bold symbol can be 3–4 cm, a detailed piece usually needs 8 cm or more.', hu: 'A részletességtől függ: egy egyszerű, vastag vonalas jel lehet 3–4 cm, egy részletes minta általában legalább 8 cm-t igényel.' } },
      { q: { en: 'How do I check the size in InkAge?', hu: 'Hogyan ellenőrizzem a méretet az InkAge-ben?' }, a: { en: 'Place the design on your photo: the editor shows the size in centimetres and has quick buttons for 3, 5, 8, 12 and 20 cm.', hu: 'Helyezd el a mintát a fotódon: a szerkesztő centiméterben mutatja a méretet, és vannak gyorsgombok 3, 5, 8, 12 és 20 cm-re.' } },
    ],
  },
  'color-vs-black-ink-aging': {
    img: 'hf_20261013_090703_f05fc30c-6d56-4d3f-a376-74e5404ad251',
    img2: 'hf_20261013_090723_d1299f18-7d91-4885-ac28-155944281cc1',
    cap2: { en: 'Not all pigments are equal: black carbon is the most stable, light colours fade first.', hu: 'Nem minden pigment egyforma: a fekete szén a legstabilabb, a világos színek fakulnak először.' },
    date: '2026-10-13',
    faq: [
      { q: { en: 'Does white ink last?', hu: 'Tartós a fehér tinta?' }, a: { en: 'White and very pale colours usually fade or yellow within a few years, especially in the sun.', hu: 'A fehér és a nagyon halvány színek általában néhány éven belül kifakulnak vagy besárgulnak, főleg napon.' } },
      { q: { en: 'Can colour be refreshed later?', hu: 'A színek később felfrissíthetők?' }, a: { en: 'Yes, a touch-up can brighten faded colours — as long as the outline has held its shape.', hu: 'Igen, egy frissítés élénkítheti a fakult színeket – amíg a kontúr megtartotta a formáját.' } },
    ],
  },
  'laser-tattoo-removal-what-to-expect': {
    img: 'hf_20261013_090703_c11b8646-bc41-40e2-8425-0d2022f8f107',
    img2: 'hf_20261013_090723_c91c49fb-f918-4ca5-a1d9-383c4f6a6a31',
    cap2: { en: 'After many sessions, a faint ghost can remain — even when the treatment went well.', hu: 'Sok kezelés után is maradhat halvány „szellemkép” – akkor is, ha jól sikerült a kezelés.' },
    date: '2026-10-13',
    faq: [
      { q: { en: 'Does laser removal hurt?', hu: 'Fáj a lézeres eltávolítás?' }, a: { en: 'Most people compare it to a rubber band snapping on the skin; clinics often use cooling or numbing cream.', hu: 'A legtöbben a bőrön pattanó gumiszalaghoz hasonlítják; a klinikák gyakran hűtést vagy érzéstelenítő krémet használnak.' } },
      { q: { en: 'Can every tattoo be removed completely?', hu: 'Minden tetoválás teljesen eltávolítható?' }, a: { en: 'Not always. Some colours and very dense ink resist, and slight skin changes may remain. A dermatologist can assess your case.', hu: 'Nem mindig. Egyes színek és a nagyon sűrű tinta ellenállnak, és enyhe bőrelváltozás maradhat. A saját esetedet bőrgyógyász tudja felmérni.' } },
    ],
  },
  'tattoo-touch-ups': {
    img: 'hf_20261013_090638_8438c93a-f72e-4822-851a-8c936d538134',
    img2: 'hf_20261013_090733_67f4dda5-8559-4a36-b585-b7a7eae7e1d3',
    cap2: { en: 'Decades later, a bold design is still readable — and easy to refresh.', hu: 'Évtizedek múlva is olvasható egy erős vonalú minta – és könnyű felfrissíteni.' },
    date: '2026-10-13',
    faq: [
      { q: { en: 'Is the first touch-up free?', hu: 'Ingyenes az első javítás?' }, a: { en: 'Many studios include one touch-up within a few months. Ask before you book.', hu: 'Sok szalon az első néhány hónapban egy javítást az árban foglal. Foglalás előtt kérdezz rá.' } },
      { q: { en: 'How often should I refresh a tattoo?', hu: 'Milyen gyakran érdemes frissíteni?' }, a: { en: 'Roughly every 8–10 years, sooner on hands, feet and sunny spots.', hu: 'Nagyjából 8–10 évente, kézen, lábon és napos helyeken korábban.' } },
    ],
  },
  'tattoos-on-darker-skin': {
    img: 'hf_20261013_090637_f4bdcc6e-6eb7-44b9-8c5f-657cc575a14d',
    img2: 'hf_20261013_090732_a9e63521-c50b-4835-84ed-07bbeac9055f',
    cap2: { en: 'Saturated, deep colours and a strong outline read beautifully on deeper skin tones.', hu: 'A telített, mély színek és az erős kontúr gyönyörűen mutatnak mélyebb bőrtónuson.' },
    date: '2026-10-13',
    faq: [
      { q: { en: 'Does colour show on dark skin?', hu: 'Látszik a szín sötét bőrön?' }, a: { en: 'Deep, saturated colours like red, purple and dark blue can show well; pastels and white often barely show.', hu: 'A mély, telített színek – piros, lila, sötétkék – jól látszhatnak; a pasztell és a fehér gyakran alig.' } },
      { q: { en: 'Can I preview it on my own skin tone?', hu: 'Megnézhetem a saját bőrtónusomon?' }, a: { en: 'Yes — upload a daylight photo of your own skin; InkAge keeps your skin tone in every stage.', hu: 'Igen – tölts fel nappali fényes fotót a saját bőrödről; az InkAge minden stádiumban megtartja a bőrtónusodat.' } },
    ],
  },
  'hand-and-finger-tattoos': {
    img: 'hf_20261013_090703_0cf2fd7f-1aab-4284-96c9-b28845a40b76',
    img2: 'hf_20261013_090733_39de14d3-21a6-4060-9349-a76241ac84dc',
    cap2: { en: 'Washing, soap and constant use: hands live a hard life, and so does their ink.', hu: 'Mosás, szappan, állandó használat: a kéz nehéz életet él, és vele a tinta is.' },
    date: '2026-10-13',
    faq: [
      { q: { en: 'Why do finger tattoos fade so fast?', hu: 'Miért fakul ilyen gyorsan az ujjtetoválás?' }, a: { en: 'The skin renews quickly and is constantly rubbed and washed, so ink is pushed out faster than elsewhere.', hu: 'A bőr gyorsan megújul, állandóan súrlódik és mossuk, ezért a tinta gyorsabban távozik, mint máshol.' } },
      { q: { en: 'Which part of the hand holds best?', hu: 'A kéz melyik része tart a legjobban?' }, a: { en: 'The back of the hand and the top of the fingers hold better than the sides and the palm.', hu: 'A kézfej és az ujjak teteje jobban tart, mint az oldaluk és a tenyér.' } },
    ],
  },
  'first-tattoo-checklist': {
    img: 'hf_20261013_090637_ca312303-c618-4a41-946b-8b783b5b3cee',
    img2: 'hf_20261013_090733_3fb1cd75-99db-4354-acec-84b322421f1c',
    cap2: { en: 'A good studio is spotless: sealed single-use needles, gloves and covered surfaces.', hu: 'Egy jó szalon makulátlan: lezárt, egyszer használatos tűk, kesztyű és letakart felületek.' },
    date: '2026-10-13',
    faq: [
      { q: { en: 'How do I pick an artist?', hu: 'Hogyan válasszak tetoválót?' }, a: { en: 'Look for healed work in their portfolio in the style you want, clean hygiene and clear aftercare instructions.', hu: 'Keress gyógyult munkákat a portfóliójában a kívánt stílusban, tiszta higiéniát és világos utókezelési leírást.' } },
      { q: { en: 'Should I bring my own design?', hu: 'Vigyek saját mintát?' }, a: { en: 'Bring references, but let the artist draw their own version — it will fit your body and age better.', hu: 'Vigyél referenciát, de hagyd, hogy a tetováló megrajzolja a saját változatát – jobban illik majd a testedhez és szebben öregszik.' } },
    ],
  },
  'tattoos-weight-change-pregnancy': {
    img: 'hf_20261013_090712_192db2fe-a457-4c2b-bd78-b1f219184113',
    img2: 'hf_20261013_090743_9f4aea4e-9b36-4bb4-b549-81411b3becc3',
    cap2: { en: 'Calves, forearms and the upper back change least when the body changes.', hu: 'A vádli, az alkar és a hát felső része változik a legkevésbé, amikor a test változik.' },
    date: '2026-10-13',
    faq: [
      { q: { en: 'Will a tattoo stretch if I build muscle?', hu: 'Megnyúlik a tetoválás, ha izmosodom?' }, a: { en: 'A little, evenly. Most designs keep their look; strict geometry can look slightly distorted.', hu: 'Kicsit és egyenletesen. A legtöbb minta megtartja a kinézetét; a szigorú geometria kissé torzulhat.' } },
      { q: { en: 'Can I get tattooed while pregnant?', hu: 'Tetováltathatok terhesen?' }, a: { en: 'Most artists and doctors advise waiting until after pregnancy and breastfeeding. Ask your doctor.', hu: 'A legtöbb tetováló és orvos azt javasolja, hogy várj a terhesség és a szoptatás utánig. Kérdezd meg az orvosodat.' } },
    ],
  },
};

export const kbMeta = (slug: string) => KB[slug];

/** Reading time in minutes (≈200 words per minute, at least 2). */
export function readMin(a: Article, lang: 'en' | 'hu') {
  const words = a.body[lang].join(' ').split(/\s+/).length + (KB[a.slug]?.faq.length || 0) * 40;
  return Math.max(2, Math.round(words / 200));
}

export type KbItem = {
  slug: string;
  cat: string;
  title: string;
  desc: string;
  img: string;
  date: string;
  min: number;
};
export function kbList(lang: 'en' | 'hu'): KbItem[] {
  return ARTICLES.map((a) => ({
    slug: a.slug,
    cat: a.tag[lang],
    title: a.title[lang],
    desc: a.desc[lang],
    img: IMG(KB[a.slug]?.img || KB_STILL, 1200),
    date: KB[a.slug]?.date || '2026-10-12',
    min: readMin(a, lang),
  }));
}

export const fmtDate = (iso: string, lang: 'en' | 'hu') =>
  new Date(iso + 'T12:00:00Z').toLocaleDateString(lang === 'hu' ? 'hu-HU' : 'en-GB', { year: 'numeric', month: 'long', day: 'numeric' });
