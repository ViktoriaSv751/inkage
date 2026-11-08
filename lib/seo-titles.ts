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

/** Search descriptions that open with the answer (same pages and queries as SEO_TITLES). */
export const SEO_DESCS: Record<string, Partial<Record<Lang, string>>> = {
  '/tudastar/tattoo-before-and-after': {
    en: 'At 10 years bold work looks almost the same; by 20–30 years fine lines widen and tight detail merges. Four tattoos followed decade by decade, plus how to read online photos.',
    es: 'A los 10 años los trazos gruesos casi no cambian; a los 20–30 las líneas finas se ensanchan. Cuatro tatuajes seguidos década a década y cómo leer las fotos de antes y después.',
    pt: 'Aos 10 anos o traço grosso quase não muda; aos 20–30 as linhas finas engrossam. Quatro tatuagens acompanhadas década a década e como ler fotos de antes e depois.',
    de: 'Nach 10 Jahren sieht kräftige Linienarbeit fast gleich aus, nach 20–30 Jahren werden feine Linien breiter. Vier Tattoos Jahrzehnt für Jahrzehnt – und wie du Vorher-nachher-Fotos liest.',
  },
  '/tudastar/laser-tattoo-removal-what-to-expect': {
    cs: 'Většina tetování potřebuje 6–12 sezení s odstupem 6–8 týdnů, tedy 1–2 roky. Jak funguje pikosekundový a Nd:YAG laser, které barvy mizí nejhůř a co čekat před a po.',
    sv: 'De flesta tatueringar behöver 6–12 behandlingar med 6–8 veckors mellanrum, alltså ett till två år. Så fungerar lasern, vilka färger som är svårast och vad du kan vänta dig.',
    no: 'De fleste tatoveringer trenger 6–12 behandlinger med 6–8 ukers mellomrom, altså ett til to år. Slik virker laseren, hvilke farger som er vanskeligst og hva du kan forvente.',
    nl: 'De meeste tattoos hebben 6–12 behandelingen nodig, 6–8 weken uit elkaar: één tot twee jaar. Hoe de laser werkt, welke kleuren het lastigst zijn en wat je kunt verwachten.',
    el: 'Τα περισσότερα τατουάζ χρειάζονται 6–12 συνεδρίες με απόσταση 6–8 εβδομάδων, δηλαδή ένα με δύο χρόνια. Πώς δουλεύει το laser, ποια χρώματα φεύγουν δυσκολότερα και τι να περιμένεις.',
    es: 'La mayoría de los tatuajes necesitan 6–12 sesiones, con 6–8 semanas entre ellas: uno o dos años. Cómo actúa el láser, qué colores cuestan más y qué esperar.',
    en: 'Most tattoos need 6–12 sessions, 6–8 weeks apart – often one to two years. How the laser works, which colours resist, what it feels like and what can remain.',
  },
  '/tudastar/laser-removal-how-many-sessions': {
    cs: 'Většina profesionálních tetování potřebuje zhruba 5–15 sezení. Na čem počet závisí (barvy, místo, typ pleti, množství barvy) a jak si ho odhadnout podle Kirby-Desai škály.',
    sv: 'De flesta professionella tatueringar behöver ungefär 5–15 behandlingar. Vad antalet beror på och hur du kan uppskatta det med Kirby–Desai-skalan.',
    nl: 'De meeste professionele tattoos hebben ongeveer 5–15 behandelingen nodig. Waar het aantal van afhangt en hoe je het inschat met de Kirby-Desai-schaal.',
    es: 'La mayoría de los tatuajes profesionales necesitan entre 5 y 15 sesiones. De qué depende el número y cómo estimarlo con la escala Kirby-Desai.',
    en: 'Most professional tattoos need about 5–15 laser sessions. What the number depends on – colours, placement, skin type, amount of ink – and how to estimate yours with the Kirby–Desai scale.',
  },
  '/tudastar/tattoo-pain-chart': {
    fil: 'Pinakamasakit sa tadyang, dibdib, gulugod, paa, kamay, tuhod at kili-kili; pinakamagaan sa labas ng braso, hita, binti at likod. Tingnan ang pain chart bago magpa-tattoo.',
    cs: 'Nejvíc bolí žebra, hrudní kost, páteř, chodidla, ruce, kolena a podpaží; nejméně vnější strana paže, stehno, lýtko a záda. Mapa bolesti tetování podle místa.',
    fi: 'Eniten sattuu kylkiluihin, rintalastaan, selkärankaan, jalkapohjiin, käsiin ja polviin; vähiten olkavarren ulkosivuun, reiteen, pohkeeseen ja yläselkään.',
    no: 'Mest vondt gjør ribbeina, brystbeinet, ryggraden, føttene, hendene og knærne; minst ytre overarm, lår, legg og øvre rygg. Smertekart for tatovering.',
  },
  '/tudastar/laser-removal-healing': {
    cs: 'Zarudnutí a otok první den, puchýře v prvních dnech a strupy 1–2 týdny jsou normální. Povrch se hojí 2–4 týdny. Jak se vyhnout jizvám a kdy jít k lékaři.',
  },
};

export const seoDesc = (path: string, L: Lang) => SEO_DESCS[path]?.[L];
