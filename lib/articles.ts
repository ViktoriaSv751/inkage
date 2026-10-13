// Short, practical guides. Rendered at /learn/[slug] (SEO) and listed in Explore.

export type Article = {
  slug: string;
  tag: { en: string; hu: string };
  title: { en: string; hu: string };
  desc: { en: string; hu: string };
  body: { en: string[]; hu: string[] }; // paragraphs; lines starting with "## " are headings
};

export const ARTICLES: Article[] = [
  {
    slug: 'how-tattoos-age',
    tag: { en: 'Basics', hu: 'Alapok' },
    title: { en: 'How tattoos age: what really happens to ink over 50 years', hu: 'Hogyan öregszik a tetoválás? Mi történik a tintával 50 év alatt' },
    desc: { en: 'Blurring, fading and skin changes, explained simply.', hu: 'Elmosódás, fakulás, bőrváltozás – egyszerűen elmagyarázva.' },
    body: {
      en: [
        'A tattoo is pigment placed in the dermis, the layer under the surface of your skin. Your immune system never fully stops trying to clear it. Immune cells swallow pigment particles, carry some away and release others nearby. That slow cycle is why every tattoo changes.',
        '## Lines spread',
        'Over decades, ink drifts a little outward. A rough rule many artists use is about a tenth of a millimetre per decade. On a bold line that is invisible. On a fine line with a gap of one millimetre next to it, the gap slowly fills in. That is why tiny, detailed tattoos often turn into a soft blur after 10 to 15 years.',
        '## Colours fade unevenly',
        'Black carbon pigment is the most stable. Reds and blues hold reasonably well. Yellows, oranges, whites and pastels fade first, especially in the sun. A colourful piece without a black outline can lose its shape as the colours soften.',
        '## The skin itself changes',
        'With age, skin gets thinner and less elastic, wrinkles form and sun damage adds spots. The tattoo moves with the skin, so it stretches and softens too. Areas like the inner arm and back age more gently than hands, feet and the outer forearm.',
        '## What you can do',
        'Choose a size that gives fine details room, prefer strong black outlines, protect the tattoo with SPF 50, and plan a touch-up every 8–10 years. InkAge lets you see the likely result on your own skin before you commit.',
      ],
      hu: [
        'A tetoválás a bőr felszíne alatti rétegbe, az irhába juttatott pigment. Az immunrendszer soha nem hagyja abba teljesen az eltávolítását: az immunsejtek bekebelezik a pigmentrészecskéket, egy részüket elszállítják, másokat a közelben engednek el. Ez a lassú körforgás az oka annak, hogy minden tetoválás változik.',
        '## A vonalak szétterülnek',
        'Évtizedek alatt a tinta kicsit kifelé vándorol. Sok tetoválóművész ökölszabálya: évtizedenként kb. egytized milliméter. Egy vastag vonalon ez nem látszik. Egy vékony vonalon, amely mellett csak egy milliméteres rés van, a rés lassan kitöltődik. Ezért válnak az apró, részletes tetoválások 10–15 év után gyakran elmosódott folttá.',
        '## A színek egyenetlenül fakulnak',
        'A fekete szénpigment a legstabilabb. A piros és a kék elég jól tart. A sárga, narancs, fehér és a pasztellszínek fakulnak először, főleg napon. Egy fekete kontúr nélküli színes minta a színek halványulásával elveszítheti a formáját.',
        '## Maga a bőr is változik',
        'Az életkorral a bőr vékonyabb és kevésbé rugalmas lesz, ráncok jelennek meg, a napkárosodás foltokat okoz. A tetoválás együtt mozog a bőrrel, így az is nyúlik és lágyul. A belső kar és a hát szelídebben öregszik, mint a kézfej, a lábfej vagy a külső alkar.',
        '## Mit tehetsz?',
        'Válassz akkora méretet, ahol a részleteknek van helyük, részesítsd előnyben az erős fekete kontúrt, védd 50-es fényvédővel, és tervezz 8–10 évente egy frissítést. Az InkAge-dzsel előre megnézheted a valószínű eredményt a saját bőrödön.',
      ],
    },
  },
  {
    slug: 'fine-line-tattoos-aging',
    tag: { en: 'Styles', hu: 'Stílusok' },
    title: { en: 'Do fine line tattoos last? An honest guide', hu: 'Tartósak a fine line tetoválások? Őszinte útmutató' },
    desc: { en: 'Why they blur, and how to get one that still looks good at 60.', hu: 'Miért mosódnak el, és hogyan legyen olyan, ami 60 évesen is szép?' },
    body: {
      en: [
        'Fine line tattoos are made with a single needle or a very small grouping. They look delicate and sharp when fresh, which is exactly why they are so popular on social media. The trade-off is durability.',
        '## Why they blur faster',
        'A thin line contains less ink, so the same amount of fading is more visible. And because fine line designs often pack details close together, the natural spread of ink fills the gaps sooner than with bold styles.',
        '## How to make one last',
        'Go slightly bigger than your first instinct, especially for script and small symbols. Ask your artist to use a slightly thicker needle for the key outlines and keep the finest lines for decoration. Leave at least one to two millimetres between lines. Choose a protected spot such as the inner forearm, upper arm, ribs or back.',
        '## Aftercare matters more',
        'Fine lines are less forgiving of sunburn and poor healing. Keep the tattoo out of the sun while it heals, then use SPF 50 every time it is exposed.',
      ],
      hu: [
        'A fine line tetoválás egyetlen tűvel vagy nagyon kis tűcsoporttal készül. Frissen finom és éles, ezért olyan népszerű a közösségi médiában. Az ára a tartósság.',
        '## Miért mosódnak el gyorsabban?',
        'A vékony vonalban kevesebb a tinta, így ugyanakkora fakulás jobban látszik. Mivel a fine line mintákban a részletek gyakran közel vannak egymáshoz, a tinta természetes szétterülése hamarabb kitölti a réseket, mint a vastagabb stílusoknál.',
        '## Hogyan lesz tartós?',
        'Válaszd kicsit nagyobbra, mint elsőre gondolnád – főleg feliratnál és apró szimbólumoknál. Kérd meg a tetoválót, hogy a fő kontúrokhoz kicsit vastagabb tűt használjon, a legvékonyabb vonalakat pedig hagyja díszítésnek. Hagyj legalább 1–2 mm-t a vonalak között. Válassz védett helyet: belső alkar, felkar, borda vagy hát.',
        '## Az utókezelés még fontosabb',
        'A vékony vonalak kevésbé bocsátják meg a leégést és a rossz gyógyulást. Gyógyulás alatt tartsd távol a naptól, utána pedig mindig használj 50-es fényvédőt, ha napot kap.',
      ],
    },
  },
  {
    slug: 'best-placement-for-tattoo-longevity',
    tag: { en: 'Placement', hu: 'Elhelyezés' },
    title: { en: 'Best and worst spots for a tattoo that lasts', hu: 'A legjobb és legrosszabb helyek egy tartós tetoválásnak' },
    desc: { en: 'Friction, sun and stretch decide how fast ink fades.', hu: 'A súrlódás, a nap és a nyúlás dönti el, milyen gyorsan fakul.' },
    body: {
      en: [
        'Three things wear tattoos down: friction, sun and stretching. The less a spot gets of each, the longer the tattoo stays crisp.',
        '## Spots that age well',
        'Inner forearm, upper arm, shoulder, upper back, ribs, thigh and calf. They are mostly covered, rub against little and stay fairly stable as you age.',
        '## Spots that fade fast',
        'Fingers and the sides of hands fade the quickest because of constant washing and friction; many finger tattoos need a touch-up within a year. Feet rub against shoes. Elbows and knees crease. The outer forearm and the back of the neck get a lot of sun.',
        '## It is still your choice',
        'A spot that fades faster is not forbidden — it just needs more care and more touch-ups. Compare two placements side by side in InkAge to see the difference on your own body.',
      ],
      hu: [
        'Három dolog koptatja a tetoválást: a súrlódás, a nap és a nyúlás. Minél kevesebbet kap egy testrész ezekből, annál tovább marad éles a tetoválás.',
        '## Jól öregedő helyek',
        'Belső alkar, felkar, váll, felső hát, borda, comb és vádli. Többnyire takarva vannak, kevés dörzsölést kapnak, és viszonylag stabilak maradnak az életkorral.',
        '## Gyorsan fakuló helyek',
        'Az ujjak és a kéz oldala fakul a leggyorsabban az állandó kézmosás és súrlódás miatt – sok ujjtetoválás már egy éven belül frissítést igényel. A lábfejet a cipő dörzsöli. A könyök és a térd gyűrődik. A külső alkar és a tarkó sok napot kap.',
        '## Ettől még a te döntésed',
        'A gyorsabban fakuló hely nem tilos – csak több törődést és gyakoribb frissítést igényel. Hasonlíts össze két elhelyezést az InkAge-ben, és nézd meg a különbséget a saját testeden.',
      ],
    },
  },
  {
    slug: 'tattoo-aftercare-sun-protection',
    tag: { en: 'Care', hu: 'Ápolás' },
    title: { en: 'Aftercare and sun protection: keep your tattoo looking new', hu: 'Utókezelés és fényvédelem: így marad újszerű a tetoválásod' },
    desc: { en: 'The small habits that add years to your ink.', hu: 'Apró szokások, amelyek éveket adnak a tetoválásodnak.' },
    body: {
      en: [
        'Most of a tattoo’s future is decided in the first few weeks and then by the sun.',
        '## The first weeks',
        'Follow your artist’s instructions. Keep it clean, use a thin layer of unscented moisturiser, do not pick the flakes, and avoid swimming pools, baths and direct sun until it has fully healed.',
        '## Sun is the main enemy',
        'UV light breaks down pigment. Cover new tattoos completely; once healed, use a broad-spectrum SPF 50 on any tattoo that will see the sun, and reapply after swimming.',
        '## Long-term habits',
        'Moisturise regularly — well-hydrated skin makes ink look sharper. Stay at a stable weight where you can, as big changes stretch the skin. Plan a touch-up every 8–10 years for crisp lines.',
        'This guide is general information, not medical advice. If a tattoo looks infected or you react to the ink, see a doctor.',
      ],
      hu: [
        'A tetoválás jövőjének nagy része az első hetekben dől el, utána pedig a napon.',
        '## Az első hetek',
        'Kövesd a tetoválód utasításait. Tartsd tisztán, használj vékony rétegben illatmentes hidratálót, ne kapard le a hámló részeket, és teljes gyógyulásig kerüld az uszodát, a kádfürdőt és a közvetlen napot.',
        '## A nap a legnagyobb ellenség',
        'Az UV-fény lebontja a pigmentet. A friss tetoválást takard el teljesen; gyógyulás után használj széles spektrumú, 50-es fényvédőt minden tetoválásra, amit nap ér, és fürdés után kend újra.',
        '## Hosszú távú szokások',
        'Hidratálj rendszeresen – a jól hidratált bőrön élesebbnek látszik a tinta. Ha lehet, tartsd stabilan a testsúlyodat, mert a nagy változások megnyújtják a bőrt. Tervezz 8–10 évente egy frissítést az éles vonalakért.',
        'Ez az útmutató általános tájékoztatás, nem orvosi tanács. Ha egy tetoválás fertőzöttnek tűnik, vagy reagálsz a tintára, fordulj orvoshoz.',
      ],
    },
  },
  {
    slug: 'tattoo-size-guide',
    tag: { en: 'Size', hu: 'Méret' },
    title: { en: 'How big should my tattoo be? A simple size guide', hu: 'Mekkora legyen a tetoválásom? Egyszerű méretútmutató' },
    desc: { en: 'The detail-to-size rule artists use.', hu: 'A részlet és méret szabálya, amit a tetoválók használnak.' },
    body: {
      en: [
        'The more detail a design has, the bigger it needs to be to stay readable in 20 years.',
        '## A quick rule of thumb',
        'Simple symbols and bold shapes can be small — 3 to 5 cm. Script needs letters at least about 1 cm tall. Designs with several elements, faces or fine shading usually need 8 cm or more, and realism often far more.',
        '## Test it on your body',
        'Print the design at the planned size and hold it against your skin, or place it in InkAge and check the centimetre readout. If the 30-year preview looks like a blur, go bigger or simplify.',
      ],
      hu: [
        'Minél több részlet van egy mintában, annál nagyobbnak kell lennie, hogy 20 év múlva is olvasható maradjon.',
        '## Gyors ökölszabály',
        'Az egyszerű szimbólumok és vastag formák lehetnek kicsik – 3–5 cm. A feliratnál a betűk legyenek legalább kb. 1 cm magasak. A több elemből álló, arcot vagy finom árnyalást tartalmazó minták általában 8 cm-t vagy többet igényelnek, a realista minták gyakran jóval többet.',
        '## Próbáld ki a testeden',
        'Nyomtasd ki a mintát a tervezett méretben, és tartsd a bőrödhöz, vagy helyezd el az InkAge-ben, és nézd meg a centiméteres kijelzést. Ha a 30 éves előnézet elmosódott, válaszd nagyobbra vagy egyszerűsíts.',
      ],
    },
  },
];

import { MORE_ARTICLES } from './articles2';
ARTICLES.push(...MORE_ARTICLES);

export const article = (slug: string) => ARTICLES.find((a) => a.slug === slug) || null;
