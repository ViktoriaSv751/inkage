import type { L2 } from './longform/types';

/**
 * Own text for each body area and style of the /tattoo/<style>-<area> pages, so every combination has its own
 * facts, not only the shared template. Pain levels follow the tattoo-pain-chart article and its pain map.
 */
export const AREA_TEXT: Record<string, { h: L2; ps: L2[] }> = {
  forearm: {
    h: { en: 'The forearm: easy to sit, easy to see', hu: 'Az alkar: könnyen bírható, jól látható' },
    ps: [
      { en: 'The outer forearm is one of the least painful places for most people, and the inner side is only a notch more sensitive. The skin is fairly firm, which keeps lines stable for years.', hu: 'Az alkar külső oldala a legtöbb ember számára az egyik legkevésbé fájdalmas hely, a belső oldal is csak egy fokkal érzékenyebb. A bőr viszonylag feszes, ami évekig stabilan tartja a vonalakat.' },
      { en: 'Its weak point is the sun: forearms are uncovered from spring to autumn, so they fade faster than an upper arm or back unless you use sunscreen. A design of 8 cm or more along the length of the arm ages best.', hu: 'A gyenge pontja a nap: az alkar tavasztól őszig fedetlen, ezért fényvédő nélkül gyorsabban halványul, mint a felkar vagy a hát. A kar hossza mentén elhelyezett, legalább 8 cm-es minta öregszik a legjobban.' },
    ],
  },
  wrist: {
    h: { en: 'The wrist: small space, constant movement', hu: 'A csukló: kis hely, állandó mozgás' },
    ps: [
      { en: 'The inner wrist has thin skin close to tendons and bone, so it stings more than the forearm. It bends hundreds of times a day and rubs against watches, bracelets and cuffs.', hu: 'A csukló belső oldalán vékony a bőr, közel az inakhoz és a csonthoz, ezért jobban csíp, mint az alkar. Naponta százszor hajlik, és dörzsöli az óra, a karkötő és a mandzsetta.' },
      { en: 'That is why tiny wrist tattoos blur sooner than the same design higher up the arm. Keep lettering at least about 1 cm tall and leave a millimetre or more between lines.', hu: 'Ezért mosódnak el a pici csuklótetoválások hamarabb, mint ugyanaz a minta feljebb a karon. A betűk legyenek legalább nagyjából 1 cm magasak, a vonalak között maradjon legalább egy milliméter.' },
    ],
  },
  'upper-arm': {
    h: { en: 'The upper arm: one of the best places to age', hu: 'A felkar: az egyik legjobban öregedő hely' },
    ps: [
      { en: 'The outer upper arm is the classic first-tattoo spot: thick skin, plenty of muscle and few nerve endings. The inner side is thinner and noticeably sharper.', hu: 'A felkar külső oldala a klasszikus első tetoválás helye: vastag bőr, sok izom és kevés idegvégződés. A belső oldal vékonyabb és érezhetően élesebb.' },
      { en: 'Sleeves keep it out of the sun for much of the year and there is little friction, so lines and colour hold up well. Weight changes and muscle growth can stretch large pieces a little.', hu: 'Az ujjak az év nagy részében védik a naptól, és kevés a súrlódás, ezért a vonalak és a színek jól tartanak. A testsúly változása és az izomnövekedés a nagy mintákat kissé megnyújthatja.' },
    ],
  },
  shoulder: {
    h: { en: 'The shoulder: room for bigger pieces', hu: 'A váll: hely a nagyobb mintáknak' },
    ps: [
      { en: 'The fleshy top and back of the shoulder are among the gentler spots; it gets sharper over the collarbone and the bony edge of the shoulder blade.', hu: 'A váll húsos teteje és hátsó része a kíméletesebb helyek közé tartozik; a kulcscsont és a lapocka csontos széle fölött élesebb.' },
      { en: 'It catches summer sun and bag straps, but it is curved and roomy, so designs that wrap the shape of the shoulder look natural and age well at a generous size.', hu: 'Nyáron éri a nap és a táskapánt, de íves és tágas, ezért a váll formáját követő minták természetesek, és nagyobb méretben jól öregszenek.' },
    ],
  },
  back: {
    h: { en: 'The upper back: the best canvas for decades', hu: 'A felső hát: a legjobb felület évtizedekre' },
    ps: [
      { en: 'The fleshy parts of the upper back and shoulder blades are very manageable; the spine and the bony edges are where it hurts.', hu: 'A felső hát és a lapockák húsos része jól bírható; a gerincnél és a csontos széleknél fáj.' },
      { en: 'Clothes cover it most of the year, it barely rubs, and the skin changes less with age than on arms or stomach. Large, detailed pieces keep their detail here longer than almost anywhere else.', hu: 'Az év nagy részében ruha takarja, alig dörzsölődik, és a bőr az évekkel kevésbé változik, mint a karon vagy a hason. A nagy, részletes minták itt szinte bárhol máshol hosszabb ideig megtartják a részleteiket.' },
    ],
  },
  ribs: {
    h: { en: 'The ribs: hard to sit, kind to the ink', hu: 'A borda: nehéz kibírni, de kíméli a tintát' },
    ps: [
      { en: 'Thin skin over bone that moves with every breath makes the ribs one of the most painful places to get tattooed. Shorter sessions and steady breathing help.', hu: 'A csonton fekvő, minden lélegzettel mozgó vékony bőr miatt a borda az egyik legfájdalmasabb hely. A rövidebb ülések és az egyenletes légzés segít.' },
      { en: 'Once healed, it is one of the better places to age: almost no sun and little wear. Weight change and pregnancy can stretch the skin, so allow a bit of size.', hu: 'Gyógyulás után az egyik jobban öregedő hely: szinte nem éri nap, és kevés a kopás. A testsúly változása és a terhesség megnyújthatja a bőrt, ezért érdemes kicsit nagyobb méretet választani.' },
    ],
  },
  ankle: {
    h: { en: 'The ankle: bone, shoes and socks', hu: 'A boka: csont, cipő és zokni' },
    ps: [
      { en: 'There is little padding over the ankle bone, so it is one of the more painful spots, and swelling after the session can last a few days.', hu: 'A bokacsont fölött kevés a párna, ezért az egyik fájdalmasabb hely, és az ülés utáni duzzanat néhány napig is eltarthat.' },
      { en: 'Socks and shoe edges rub it every day and summer sun hits it hard, so fine detail fades sooner than on the calf. Bolder lines and a slightly larger size last longer.', hu: 'A zokni és a cipő széle naponta dörzsöli, nyáron pedig erősen éri a nap, ezért a finom részletek hamarabb halványulnak, mint a vádlin. A vastagabb vonalak és a kicsit nagyobb méret tovább tart.' },
    ],
  },
  hand: {
    h: { en: 'The hand: the fastest place to fade', hu: 'A kézfej: itt halványul a leggyorsabban' },
    ps: [
      { en: 'Hands are full of nerve endings with bone close to the surface, so they hurt. The skin renews quickly and is washed, rubbed and sunned all day.', hu: 'A kéz tele van idegvégződéssel, a csont közel van a felszínhez, ezért fáj. A bőr gyorsan megújul, és egész nap mossák, dörzsölik és éri a nap.' },
      { en: 'Expect touch-ups within the first year or two and keep the design simple and bold. Many artists check the size and placement with you more carefully here than anywhere else.', hu: 'Számíts arra, hogy az első egy-két évben javítás kell, és a minta legyen egyszerű és erős. Sok tetováló itt minden más helynél alaposabban egyezteti veled a méretet és a helyet.' },
    ],
  },
  finger: {
    h: { en: 'The finger: small, sore and short-lived', hu: 'Az ujj: kicsi, fájós és rövid életű' },
    ps: [
      { en: 'Finger tattoos hurt more than their size suggests, and the sides of the fingers and the palm side shed ink fastest of all.', hu: 'Az ujjtetoválás jobban fáj, mint amit a mérete sejtet, és az ujjak oldala, illetve a tenyér felőli rész veszíti el a leggyorsabban a tintát.' },
      { en: 'Lines spread and patches drop out within months to a few years, so many people treat finger tattoos as something to refresh regularly. The top of the finger holds better than the sides.', hu: 'A vonalak szétterülnek, foltok tűnnek el hónapok vagy néhány év alatt, ezért sokan rendszeresen felfrissítendőnek tekintik az ujjtetoválást. Az ujj teteje jobban tart, mint az oldala.' },
    ],
  },
  neck: {
    h: { en: 'The neck: visible, thin-skinned and sun-exposed', hu: 'A nyak: látható, vékony bőrű és napos' },
    ps: [
      { en: 'The back of the neck is the easiest part to sit; the sides are sharper and the throat is among the most painful places. The skin is thin and creases as you turn your head.', hu: 'A tarkó a legkönnyebben bírható rész; az oldala élesebb, a torok pedig a legfájdalmasabb helyek közé tartozik. A bőr vékony, és ráncolódik, ahogy fordítod a fejed.' },
      { en: 'Sun and creasing make fine detail on the neck soften sooner, while bold work holds well. Sunscreen matters more here than almost anywhere.', hu: 'A nap és a ráncolódás miatt a finom részletek a nyakon hamarabb puhulnak, a vastag vonalas munka viszont jól tart. A fényvédő itt szinte mindenhol másnál fontosabb.' },
    ],
  },
};

export const STYLE_TEXT: Record<string, L2> = {
  'fine-line': { en: 'Fine line work is made with one or very few needles. It looks crisp on day one, but thin lines sit close to the width ink naturally spreads over the years, so give the design room: fewer elements, more space between them and a larger size than you first imagined.', hu: 'A fine line munka egy vagy nagyon kevés tűvel készül. Az első napon éles, de a vékony vonalak közel vannak ahhoz a szélességhez, amennyit a tinta az évek alatt természetesen szétterül, ezért adj teret a mintának: kevesebb elem, több hely köztük, és nagyobb méret, mint amit elsőre elképzeltél.' },
  blackwork: { en: 'Blackwork uses solid black and bold shapes, the most stable combination in tattooing. Black absorbs laser light well and resists sun better than colour, and big shapes have room to soften without losing their outline.', hu: 'A blackwork tömör feketét és erős formákat használ, ez a tetoválás legstabilabb kombinációja. A fekete jól elnyeli a fényt, jobban bírja a napot, mint a színek, a nagy formáknak pedig van helyük puhulni anélkül, hogy elveszítenék a körvonalukat.' },
  traditional: { en: 'Traditional work combines heavy black outlines with a small palette, which is why decades-old pieces still read clearly. Reds and yellows inside the outlines fade first, but the black structure keeps the design recognisable.', hu: 'A tradicionális stílus vastag fekete kontúrt kevés színnel párosít, ezért olvashatók még az évtizedes darabok is. A kontúrokon belül a piros és a sárga halványul először, de a fekete váz felismerhetővé teszi a mintát.' },
  color: { en: 'Colour work depends on its black and its contrast. Pale shades such as yellow, pastel and light blue fade first, especially in the sun, so a dark outline or strong contrast helps colour pieces stay readable.', hu: 'A színes munka a feketén és a kontraszton múlik. A világos árnyalatok, például a sárga, a pasztell és a világoskék halványulnak először, főleg napon, ezért egy sötét kontúr vagy az erős kontraszt segít, hogy a színes minta olvasható maradjon.' },
  realism: { en: 'Realism imitates photographs with soft gradients and fine detail. It needs strong contrast and enough size, typically 10 cm or more for a face, so that eyes and small features stay readable as the ink softens over the decades.', hu: 'A realizmus lágy átmenetekkel és finom részletekkel fényképet utánoz. Erős kontraszt és elég nagy méret kell hozzá, egy archoz általában 10 cm vagy több, hogy a szemek és az apró vonások évtizedek múlva is felismerhetők maradjanak.' },
};
