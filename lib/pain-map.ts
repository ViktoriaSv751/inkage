import { tx, type Lang } from './tr';
import type { PainText } from '@/app/tudastar/[slug]/PainMap';

/** Texts of the interactive pain map on the tattoo-pain-chart article; levels follow that article's three groups. */
export function painMapText(L: Lang): PainText {
  const T = (en: string, hu: string) => tx(L, en, hu);
  const z = (id: string, lvl: 0 | 1 | 2, name: [string, string], note: [string, string]) => ({ id, lvl, name: T(...name), note: T(...note) });
  return {
    title: T('Interactive tattoo pain map', 'Interaktív tetoválás fájdalomtérkép'),
    hint: T('Tap a body area to see how much it usually hurts and why.', 'Koppints egy testrészre, és megmutatjuk, mennyire szokott fájni és miért.'),
    front: T('Front view', 'Elöl'),
    back: T('Back view', 'Hátul'),
    levels: [T('Least painful (about 1–4 of 10)', 'A legkevésbé fáj (kb. 1–4 a tízből)'), T('Moderate (about 4–6 of 10)', 'Közepes (kb. 4–6 a tízből)'), T('Most painful (about 7–10 of 10)', 'A legjobban fáj (kb. 7–10 a tízből)')],
    zones: [
      z('outer-upper-arm', 0, ['Outer upper arm and shoulder', 'Felkar külső oldala és váll'], ['Thick skin, plenty of muscle, few nerve endings: the classic first-tattoo spot.', 'Vastag bőr, sok izom, kevés idegvégződés: a klasszikus első tetoválás helye.']),
      z('inner-upper-arm', 1, ['Inner upper arm', 'Felkar belső oldala'], ['Thinner skin and many nerves, noticeably sharper than the outer side.', 'Vékonyabb bőr és sok ideg, érezhetően élesebb, mint a külső oldal.']),
      z('armpit', 2, ['Armpit', 'Hónalj'], ['One of the most sensitive areas, with many nerve endings and lymph nodes.', 'Az egyik legérzékenyebb terület, sok idegvégződéssel és nyirokcsomóval.']),
      z('elbow', 2, ['Elbow', 'Könyök'], ['Bone right under the skin and constantly moving skin in the crease.', 'Közvetlenül a bőr alatt csont, a hajlatban folyton mozgó bőr.']),
      z('forearm', 0, ['Outer forearm', 'Alkar külső oldala'], ['Surprisingly easy for most people; the inner side is a notch more sensitive.', 'A legtöbbeknek meglepően könnyű; a belső oldal egy fokkal érzékenyebb.']),
      z('hand', 2, ['Hands and fingers', 'Kézfej és ujjak'], ['Full of nerve endings and bone close to the surface – and they also fade fast.', 'Tele idegvégződéssel, a csont közel a felszínhez – ráadásul gyorsan halványulnak.']),
      z('chest', 1, ['Chest (pectoral muscle)', 'Mellkas (mellizom)'], ['Bearable over the muscle, stronger towards the collarbone and sternum.', 'Az izom fölött elviselhető, a kulcscsont és a szegycsont felé erősebb.']),
      z('sternum', 2, ['Sternum', 'Szegycsont'], ['Almost straight onto bone, and the vibration is felt through the chest.', 'Szinte közvetlenül a csonton, a rezgés az egész mellkasban érződik.']),
      z('ribs', 2, ['Ribs and sides', 'Bordák és oldal'], ['Thin skin over bone that moves with every breath; many call it the hardest spot.', 'Vékony bőr a csonton, minden lélegzettel mozog; sokan ezt tartják a legnehezebbnek.']),
      z('stomach', 1, ['Stomach', 'Has'], ['Varies a lot from person to person; looser skin is harder to work on.', 'Emberenként nagyon eltérő; a lazább bőrt nehezebb tetoválni.']),
      z('outer-thigh', 0, ['Outer and front thigh', 'Comb külső és első oldala'], ['A large, fleshy area where even bigger designs are quite bearable.', 'Nagy, húsos terület, ahol még a nagyobb minták is jól elviselhetők.']),
      z('inner-thigh', 1, ['Inner thigh', 'Comb belső oldala'], ['Thin, sensitive skin – often more unpleasant than people expect.', 'Vékony, érzékeny bőr – gyakran kellemetlenebb, mint várnák.']),
      z('knee', 2, ['Knee and back of the knee', 'Térd és térdhajlat'], ['Bone on the kneecap and thin, moving skin in the crease.', 'Csont a térdkalácson, vékony, mozgó bőr a hajlatban.']),
      z('shin', 2, ['Shin', 'Sípcsont'], ['Skin directly over the bone; the sensation gets stronger quickly here.', 'A bőr közvetlenül a csonton; itt gyorsan erősödik az érzés.']),
      z('foot', 2, ['Feet and ankles', 'Lábfej és boka'], ['Little padding, lots of bone and nerves.', 'Kevés párna, sok csont és ideg.']),
      z('neck-back', 1, ['Back of the neck', 'Tarkó'], ['Sharper close to the spine and around the hairline.', 'A gerinc közelében és a hajvonalnál élesebb.']),
      z('upper-back', 0, ['Upper back and shoulder blades', 'Felső hát és lapockák'], ['Very manageable on the fleshy part; stronger towards the spine.', 'A húsos részen jól bírható; a gerinc felé erősebb.']),
      z('spine', 2, ['Spine', 'Gerinc'], ['Over the vertebrae, the needle’s vibration runs along the back.', 'A csigolyák fölött a tű rezgése végigfut a háton.']),
      z('buttocks', 0, ['Buttocks', 'Fenék'], ['Few tattoos go here, but it is one of the gentlest areas.', 'Kevés tetoválás kerül ide, de az egyik legkíméletesebb terület.']),
      z('calf', 0, ['Calf', 'Vádli'], ['Muscular and cushioned; towards the shin it gets stronger.', 'Izmos és párnázott; a sípcsont felé erősebb.']),
    ],
  };
}
