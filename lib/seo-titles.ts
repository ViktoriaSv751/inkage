import type { Lang } from './tr';

/**
 * Search titles written for what people actually type (Search Console queries, 2026-11-08), per page and language.
 * Only the <title> changes: the article's own headline and its translations (keyed by the English text) stay as
 * they are. Pages or languages not listed keep their normal title.
 */
export const SEO_TITLES: Record<string, Partial<Record<Lang, string>>> = {
  '/tudastar': {
    zhs: '纹身知识库：纹身10、20、30年后会变成什么样',
    zh: '紋身知識庫：紋身10、20、30年後會變成什麼樣',
    en: 'Tattoo aging guide: how tattoos look after 10, 20 and 30 years',
  },
  '/tudastar/tattoo-before-and-after': {
    en: 'Tattoos after 20 years: before and after, decade by decade',
    es: 'Tatuajes antes y después: así se ven a los 10, 20 y 30 años',
    pt: 'Tatuagem antes e depois: como fica depois de 10, 20 e 30 anos',
    fi: 'Tatuointi ennen ja jälkeen: miltä se näyttää 10, 20 ja 30 vuoden päästä',
    pl: 'Tatuaż po 20 latach: przed i po, dekada po dekadzie',
    de: 'Tattoo vorher nachher: so sieht es nach 10, 20 und 30 Jahren aus',
    fr: 'Tatouage avant après : à quoi il ressemble après 10, 20 et 30 ans',
  },
  '/tudastar/laser-tattoo-removal-what-to-expect': {
    cs: 'Laserové odstranění tetování: před a po, počet sezení, pikosekundový a Nd:YAG laser',
    sv: 'Ta bort tatuering med laser: före och efter, antal behandlingar, smärta',
    no: 'Laserfjerning av tatovering: før og etter, antall behandlinger, smerte',
    nl: 'Tattoo laseren: ervaringen, voor en na, aantal behandelingen',
    el: 'Αφαίρεση τατουάζ με laser: πριν και μετά, συνεδρίες, πόνος',
    es: 'Eliminar un tatuaje con láser: antes y después, sesiones y dolor',
    en: 'Laser tattoo removal: before and after, sessions, pain and cost',
  },
  '/tudastar/laser-removal-how-many-sessions': {
    cs: 'Odstranění tetování laserem: kolik sezení je potřeba?',
    sv: 'Ta bort tatuering: hur många behandlingar behövs?',
    nl: 'Tattoo verwijderen: hoeveel behandelingen heb je nodig?',
    es: 'Eliminar un tatuaje con láser: ¿cuántas sesiones necesitas?',
    en: 'How many laser tattoo removal sessions will you need?',
  },
  '/tudastar/laser-removal-healing': {
    cs: 'Hojení po laserovém odstranění tetování: péče, jizvy a co je normální',
    sv: 'Läkning efter laserborttagning av tatuering: eftervård dag för dag',
  },
  '/tudastar/tattoo-pain-chart': {
    fil: 'Masakit ba magpa-tattoo? Pain chart: saan pinakamasakit',
    cs: 'Kde tetování nejvíc bolí? Mapa bolesti podle místa',
    fi: 'Sattuuko tatuointi? Tatuoinnin kipukartta paikan mukaan',
    no: 'Gjør tatovering vondt? Smertekart for tatovering',
  },
  '/tudastar/fine-line-tattoos-aging': {
    da: 'Fine line tatovering: hvordan holder den over tid?',
    sv: 'Fine line tatuering (fin linje): så åldras den',
  },
  '/tudastar/first-tattoo-checklist': {
    cs: 'Jak se objednat na tetování: checklist před prvním tetováním',
  },
  '/tudastar/tattoos-when-you-get-old': {
    nl: 'Tattoos en ouder worden: zo ziet je tattoo eruit als je oud bent',
    de: 'Tattoos im Alter: so sieht dein Tattoo mit 70 aus',
  },
  '/tudastar/hand-and-finger-tattoos': {
    es: 'Tatuajes en los dedos y la mano: problemas, cuánto duran y por qué se borran',
    pt: 'Tatuagem no dedo sai? Quanto dura uma tatuagem na mão',
  },
  '/tattoo/blackwork-neck': {
    es: 'Tatuaje blackwork en el cuello: ideas y cómo se ve con los años',
    pt: 'Tatuagem blackwork no pescoço: ideias e como fica com o tempo',
  },
  '/tattoo/blackwork-forearm': {
    pt: 'Tatuagem blackwork no antebraço: como fica com o tempo',
  },
};

export const seoTitle = (path: string, L: Lang) => SEO_TITLES[path]?.[L];
