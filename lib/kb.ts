import { localeOf, type Lang } from '@/lib/tr';
// Knowledge base extras: pictures, categories, dates and short FAQs for every guide.


/** Pre-rendered photo widths (see scripts/prebuild-images.mjs). */
export const IMG_W = [480, 900, 1400, 1800] as const;
const snap = (w: number) => IMG_W.find((x) => x >= w) ?? 1800;
/** A static, CDN-cached WebP copy of a photo at (at least) width w. */
// the store apps carry no photos: they load them from the website
const IMG_HOST = process.env.NEXT_PUBLIC_NATIVE_BUNDLE ? 'https://inkage.app' : '';
export const IMG = (f: string, w = 1200) => `${IMG_HOST}/img/${f}-${snap(w)}.webp`;
/** srcset for responsive <img>, up to max width. */
export const IMGSET = (f: string, max = 1800) =>
  IMG_W.filter((w) => w <= max).map((w) => `${IMG_HOST}/img/${f}-${w}.webp ${w}w`).join(', ');

export const KB_HERO = 'hf_20261013_090802_c2968625-4757-4c65-8bfd-d6c8e7ff7d3a';
export const KB_STILL = 'hf_20261013_090802_e242c395-fb5f-4641-9966-35e791e242a1';

type L2 = { en: string; hu: string };
export type KbMeta = {
  img: string;
  img2: string;
  img3: string;
  img4: string;
  /** extra inline photos for the longer articles ([[img5]] … [[img7]]) */
  img5?: string;
  img6?: string;
  img7?: string;
  cap2: L2;
  date: string; // ISO
  faq: { q: L2; a: L2 }[];
};

export const KB: Record<string, KbMeta> = {
  'how-tattoos-age': {
    img: 'hf_20261013_090637_00bc55f1-c4f6-4bb3-af84-c63dff9cd69b',
    img2: 'hf_20261013_090713_9a5ab662-392f-41d6-9e0b-52da1e87bfe3',
    img3: 'hf_20261013_094459_2d3efbdc-5e36-4b8d-9785-c55d3898371c',
    img4: 'hf_20261013_094404_d807408e-be3b-430e-bf2b-73bd75bd0580',
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
    img3: 'hf_20261013_094347_cbf133c7-fa89-427a-8175-4598726b0beb',
    img4: 'hf_20261013_094347_b4d10f82-b3dc-4539-829a-2008bcd0e319',
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
    img3: 'hf_20261013_094338_f9fb305b-0949-4414-ac0a-856b33f1899d',
    img4: 'hf_20261013_094337_45af2df1-c3bb-44ef-b714-79b69b796e48',
    cap2: { en: 'Ankles, feet and hands rub against shoes and everything we touch, so they fade faster.', hu: 'A boka, a lábfej és a kéz folyamatosan súrlódik, ezért gyorsabban fakul.' },
    date: '2026-10-12',
    faq: [
      { q: { en: 'Which places age best?', hu: 'Mely helyek öregszenek a legszebben?' }, a: { en: 'Upper back, shoulder blade, upper arm and outer thigh: little sun, little friction and stable skin.', hu: 'A hát felső része, a lapocka, a felkar és a comb külső oldala: kevés nap, kevés súrlódás és stabil bőr.' } },
      { q: { en: 'And which fade fastest?', hu: 'És melyek fakulnak a leggyorsabban?' }, a: { en: 'Fingers, palms, sides of the hands and feet, and lips.', hu: 'Az ujjak, a tenyér, a kéz és a láb oldala, valamint az ajak.' } },
    ],
  },
  'tattoo-aftercare-sun-protection': {
    img: 'hf_20261013_090704_eeabc335-2a0b-4d50-9b73-5f2f90bc233d',
    img2: 'hf_20261013_094417_293532cd-cf72-41b9-87bb-12b4b7739211',
    img3: 'hf_20261013_094416_60604336-078c-4a71-9ff9-d2a09d610517',
    img4: 'hf_20261013_094429_81d130d0-2b13-4f9e-8d15-d533be516cf7',
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
    img3: 'hf_20261013_094428_03d5223f-83ed-4279-a522-78515046a4c0',
    img4: 'hf_20261013_094430_b9ac0b46-6b1d-4d32-ae38-94a42cf28259',
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
    img3: 'hf_20261013_094338_aab2d4a5-69f1-4315-a61f-527f7e91297f',
    img4: 'hf_20261013_094338_b817e2c6-5f01-4b84-b64f-1645f4839ba4',
    cap2: { en: 'Not all pigments are equal: black carbon is the most stable, light colours fade first.', hu: 'Nem minden pigment egyforma: a fekete szén a legstabilabb, a világos színek fakulnak először.' },
    date: '2026-10-13',
    faq: [
      { q: { en: 'Does white ink last?', hu: 'Tartós a fehér tinta?' }, a: { en: 'White and very pale colours usually fade or yellow within a few years, especially in the sun.', hu: 'A fehér és a nagyon halvány színek általában néhány éven belül kifakulnak vagy besárgulnak, főleg napon.' } },
      { q: { en: 'Can colour be refreshed later?', hu: 'A színek később felfrissíthetők?' }, a: { en: 'Yes, a touch-up can brighten faded colours — as long as the outline has held its shape.', hu: 'Igen, egy frissítés élénkítheti a fakult színeket – amíg a kontúr megtartotta a formáját.' } },
    ],
  },
  'laser-tattoo-removal-what-to-expect': {
    img: 'hf_20261013_090703_c11b8646-bc41-40e2-8425-0d2022f8f107',
    img2: 'hf_20261013_094405_e4565f7f-7e3b-459b-a9b4-b763da2af205',
    img3: 'hf_20261013_094416_db31d0f2-88ed-4311-aef7-3745cabd5626',
    img4: 'hf_20261013_094417_e49926a7-7645-464b-b21e-225756521eea',
    cap2: { en: 'After many sessions, a faint ghost can remain — even when the treatment went well.', hu: 'Sok kezelés után is maradhat halvány „szellemkép” – akkor is, ha jól sikerült a kezelés.' },
    date: '2026-10-13',
    faq: [
      { q: { en: 'Does laser removal hurt?', hu: 'Fáj a lézeres eltávolítás?' }, a: { en: 'Most people compare it to a rubber band snapping on the skin; clinics often use cooling or numbing cream.', hu: 'A legtöbben a bőrön pattanó gumiszalaghoz hasonlítják; a klinikák gyakran hűtést vagy érzéstelenítő krémet használnak.' } },
      { q: { en: 'Can every tattoo be removed completely?', hu: 'Minden tetoválás teljesen eltávolítható?' }, a: { en: 'Not always. Some colours and very dense ink resist, and slight skin changes may remain. A dermatologist can assess your case.', hu: 'Nem mindig. Egyes színek és a nagyon sűrű tinta ellenállnak, és enyhe bőrelváltozás maradhat. A saját esetedet bőrgyógyász tudja felmérni.' } },
    ],
  },
  'tattoo-touch-ups': {
    img: 'hf_20261013_090638_8438c93a-f72e-4822-851a-8c936d538134',
    img2: 'hf_20261013_094429_0b13446a-4b51-47ed-a11e-331f8a9aa543',
    img3: 'hf_20261013_094451_9d67214a-4627-469e-bca0-56a58bbf88ff',
    img4: 'hf_20261013_090733_67f4dda5-8559-4a36-b585-b7a7eae7e1d3',
    cap2: { en: 'Decades later, a bold design is still readable — and easy to refresh.', hu: 'Évtizedek múlva is olvasható egy erős vonalú minta – és könnyű felfrissíteni.' },
    date: '2026-10-13',
    faq: [
      { q: { en: 'Is the first touch-up free?', hu: 'Ingyenes az első javítás?' }, a: { en: 'Many studios include one touch-up within a few months. Ask before you book.', hu: 'Sok szalon az első néhány hónapban egy javítást az árban foglal. Foglalás előtt kérdezz rá.' } },
      { q: { en: 'How often should I refresh a tattoo?', hu: 'Milyen gyakran érdemes frissíteni?' }, a: { en: 'Roughly every 8–10 years, sooner on hands, feet and sunny spots.', hu: 'Nagyjából 8–10 évente, kézen, lábon és napos helyeken korábban.' } },
    ],
  },
  'tattoos-on-darker-skin': {
    img: 'hf_20261013_090637_f4bdcc6e-6eb7-44b9-8c5f-657cc575a14d',
    img2: 'hf_20261013_094450_7e3c8a2e-459b-4086-8dac-23d3cbe2de71',
    img3: 'hf_20261013_094449_696ccba4-eafa-4d2c-9362-c39c63e5be19',
    img4: 'hf_20261013_090732_a9e63521-c50b-4835-84ed-07bbeac9055f',
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
    img3: 'hf_20261013_094406_f23485d1-fdae-4625-8640-3304800a1abc',
    img4: 'hf_20261013_094405_aaa47d0b-2f50-4c92-80e3-8c69ee63a852',
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
    img3: 'hf_20261013_094347_56983c62-140d-4c10-b37e-2bf0682c4a1b',
    img4: 'hf_20261013_094348_fa04678b-2125-4f55-9708-311bbe98a9e9',
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
    img3: 'hf_20261013_094450_57f78b06-1651-4d3f-b148-8d893df25853',
    img4: 'hf_20261013_094458_a5efb8d8-885a-4de3-8648-858e3eba2e01',
    cap2: { en: 'Calves, forearms and the upper back change least when the body changes.', hu: 'A vádli, az alkar és a hát felső része változik a legkevésbé, amikor a test változik.' },
    date: '2026-10-13',
    faq: [
      { q: { en: 'Will a tattoo stretch if I build muscle?', hu: 'Megnyúlik a tetoválás, ha izmosodom?' }, a: { en: 'A little, evenly. Most designs keep their look; strict geometry can look slightly distorted.', hu: 'Kicsit és egyenletesen. A legtöbb minta megtartja a kinézetét; a szigorú geometria kissé torzulhat.' } },
      { q: { en: 'Can I get tattooed while pregnant?', hu: 'Tetováltathatok terhesen?' }, a: { en: 'Most artists and doctors advise waiting until after pregnancy and breastfeeding. Ask your doctor.', hu: 'A legtöbb tetováló és orvos azt javasolja, hogy várj a terhesség és a szoptatás utánig. Kérdezd meg az orvosodat.' } },
    ],
  },
  'tattoo-pain-chart': {
    img: 'hf_20261020_115959_f93a1786-77c5-4f85-94ac-2e6723a1e9f6',
    img2: 'hf_20261020_115959_eaa4057c-5251-4cc5-9c16-06ac1ee4702d',
    img3: 'hf_20261020_115958_7768ec4d-b30e-4b8f-8693-7ec8cf79f8a2',
    img4: 'hf_20261020_115959_a4fd41da-6503-44e2-8f94-05f51b2a7bca',
    cap2: { en: 'Most people find the outer upper arm one of the gentlest places for a first tattoo.', hu: 'A legtöbben a felkar külső oldalát az egyik legkíméletesebb helynek érzik egy első tetováláshoz.' },
    date: '2026-10-20',
    faq: [],
  },
  'tattoo-before-and-after': {
    img: 'hf_20261023_115651_30665362-3381-4165-8733-cf639fa069c4',
    img2: 'hf_20261023_115652_120cffa0-f05f-4fc8-a14c-869f3727b2d1',
    img3: 'hf_20261023_115651_1be791b4-bc4f-468e-838a-1aa3c4dd1bb5',
    img4: 'hf_20261023_115927_22759cfc-9a87-4aac-8c84-d2981ee57262',
    img5: 'hf_20261023_115926_581273ec-64e1-44ac-a617-ebecd1d61028',
    img6: 'hf_20261023_115927_b0f24c29-c8be-49bd-b3f6-51ac8cd1a0af',
    img7: 'hf_20261023_115651_d0d01a22-1f68-4ad2-9516-858707e2ed94',
    cap2: { en: 'Healed lines soften first; bold shapes keep their silhouette for decades.', hu: 'A gyógyult vonalak puhulnak először; az erős formák évtizedekig megtartják a sziluettjüket.' },
    date: '2026-10-23',
    faq: [],
  },
  'tattoos-that-age-well': {
    img: 'hf_20261023_115651_74f5540a-d732-49ce-9cfb-b8cce2ed0004',
    img2: 'hf_20261023_115652_688de8a0-1246-4325-a2f5-63f3d6e6317e',
    img3: 'hf_20261023_115653_2b8a9237-aea1-495e-a90c-4a4877623bc9',
    img4: 'hf_20261023_115652_1f1e0b5a-8e8f-4d5c-bee9-e2f7b2961e24',
    img5: 'hf_20261023_115926_b4da344f-5221-4c92-84bd-6f5b23bcfb44',
    img6: 'hf_20261023_115946_88ed5da8-82fe-44d8-932c-2f425e3a4fa9',
    img7: 'hf_20261023_115945_3a8246cc-8f38-4cb0-a034-f6f16514c162',
    cap2: { en: 'Bold will hold: thick outlines and solid black are the most durable things in tattooing.', hu: 'Ami erős, megmarad: a vastag kontúr és a telt fekete a legtartósabb a tetoválásban.' },
    date: '2026-10-23',
    faq: [],
  },
  'tattoos-when-you-get-old': {
    img: 'hf_20261023_115947_3e880baf-f428-45d4-8995-fdb1c29f163a',
    img2: 'hf_20261023_115946_9d63ecd5-0259-4cfc-aec2-c639c0e5d82e',
    img3: 'hf_20261023_183059_953b4efd-de4e-49d1-8c46-ff953e3196f8',
    img4: 'hf_20261023_115945_05be4267-c30f-4021-bd8c-0560c221b0d7',
    img5: 'hf_20261023_115946_816b9883-de16-4afe-b70f-3ae2f9bbe1f8',
    img6: 'hf_20261023_183058_806d294c-b016-49c6-b118-924adad2c3e6',
    img7: 'hf_20261023_183059_53a3cddb-6e4a-4790-8b7a-d0f3f71ba13c',
    cap2: { en: 'On older skin a tattoo speaks through its silhouette, softened but still recognisably itself.', hu: 'Idős bőrön a tetoválás a sziluettjével beszél: megszelídülve, de felismerhetően önmaga.' },
    date: '2026-10-23',
    faq: [],
  },
  'tattoo-blowout': {
    img: 'hf_20261024_060504_99773259-628c-4d6b-a3ee-cab74580d3cb',
    img2: 'hf_20261024_060504_46623306-8526-4952-9ac3-67532bb9e04b',
    img3: 'hf_20261024_060504_34e05c93-aad9-44b6-b18f-65be93f5fa6b',
    img4: 'hf_20261024_060504_6044e5b4-b877-46a9-b94c-24e5648a1c02',
    img5: 'hf_20261024_060513_145f07da-723d-4c5f-85a6-bba068614c44',
    img6: 'hf_20261024_060513_a8586ecc-0f7f-4f55-b42d-ac1edf111d03',
    img7: 'hf_20261024_060513_38671182-f2fc-49d2-8d46-3b94e1da42d2',
    cap2: { en: 'A blowout is ink that spread under the skin: a soft blue haze that stays after healing.', hu: 'A blowout a bőr alatt szétterült tinta: lágy, kékes pára, ami a gyógyulás után is megmarad.' },
    date: '2026-10-24',
    faq: [],
  },
};

export const kbMeta = (slug: string) => KB[slug];

export const fmtDate = (iso: string, lang: Lang) =>
  new Date(iso + 'T12:00:00Z').toLocaleDateString(localeOf(lang), { year: 'numeric', month: 'long', day: 'numeric' });
