# InkAge – screenshot plan (App Store + Google Play, 2026-11-06)

Six screenshots, ordered by persuasion: the first two decide the install (most people never swipe past the
third), so the unique hook (aging on your own skin) comes first and the main search intent (try-on) second.
Each screenshot is **one result image pair** (left/right split with a drag line, or top/bottom on tall frames)
with a **big caption** on top and a short sub-caption under it. Every pair is a real AI result from the app's own
pipeline, labelled "Real AI result" in a corner (as in the current `store/screenshots/en-1-hero.png`).

Rules: no "free" wording, no other app or social-network names, no device frame with fake UI, no claim beyond the
listing (`LISTING-ASO.md`). Keep the caption to two short lines; the headline is the line people read in search.

## Formats and how to render

- App Store 6.9": 1290×2796 (or 1320×2868); 6.3": 1206×2622. Google Play phone: 1080×1920.
- The frames already render from `app/promo/[n]` with `node scripts/promo-shots.mjs [baseUrl] [outDir]`
  (currently `en` and `hu`, 6 frames). To ship this plan: change the six frames in `app/promo/[n]/page.tsx` to the
  pairs below, add the 12 caption languages, and add `de es fr pt it nl pl cs ja sv` to the language loop.
- Image ids below are the file prefixes in `public/img/` (gitignored; made by `scripts/prebuild-images.mjs`,
  present in the main checkout). Use the `-1800.webp` size for 1290-wide frames.

## The six screenshots

| # | Pair (left → right) | Existing images in `public/img` | Status |
|---|---|---|---|
| 1 | Sun-and-moon wrist: today → 50 years | `hf_20261012_125250_eb1fedf5` (0 y) → `hf_20261012_125519_356de094` (50 y) | Ready (current hero uses it) |
| 2 | Bare forearm photo → the same photo with a fresh tattoo | none – no bare-skin "before" exists | **New pair needed** (one run in the app: photo or model photo + a library design; keep the input photo as "before") |
| 3 | Dotwork mandala on the calf: 10 years → 50 years | `hf_20261013_204308_32cb3de1` (10 y) → `hf_20261013_204308_b1d4b7fe` (50 y); also `hf_20261013_204219_480510e4` (0 y), `hf_20261013_204311_202be418` (30 y) for a 4-dot slider strip under the pair | Ready |
| 4 | Swallow on the shoulder blade (as "your tattoo now") → 50 years | `hf_20261013_200843_15e0b201` (0 y) → `hf_20261013_200918_3120c2be` (50 y); middle stages `hf_20261013_200913_a2cc2bf1`, `hf_20261013_200914_28a5dcbe`, `hf_20261013_200914_80587d64` | Ready |
| 5 | A tattoo today → after 10 laser sessions | `hf_20261013_090723_c91c49fb` and `hf_20261013_094405_e4565f7f` are faded "after"-style arms only, with no matching "before" – do not pair them with an unrelated photo | **New pair needed** (run Removal mode on the rose `hf_20261013_200843_f699cd39`, take laser10; laser3/laser6 can go in a small strip) |
| 6 | Fine-line rose: fresh → 50 years, with the longevity score chip | `hf_20261013_200843_f699cd39` (fresh) → `hf_20261013_200913_5ffd13b1` (50 y) (current `en-2-rose.png`) | Ready; score chip drawn in the frame |

Not pairs, but usable as small backgrounds or the Play feature graphic: `hf_20261013_090754_b336f404` (person
photographing their arm), `hf_20261013_090754_fed474a4` (friends looking at a phone – vote link),
`hf_20261013_090637_ca312303` (artist's desk flat lay – PDF for the artist), `hf_20261013_094428_03d5223f`
(three paper sizes on a forearm – size).

## Captions (headline / sub-caption)

### 1 – Today → 50 years (hook: tattoo aging preview)

| Lang | Headline | Sub-caption |
|---|---|---|
| en | See your tattoo in 50 years | On your own skin, before it's permanent |
| hu | A tetoválásod 50 év múlva | A saját bőrödön, mielőtt végleges lesz |
| de | Dein Tattoo in 50 Jahren | Auf deiner Haut, bevor es für immer ist |
| es | Tu tatuaje dentro de 50 años | En tu piel, antes de que sea para siempre |
| fr | Ton tatouage dans 50 ans | Sur ta peau, avant qu'il soit pour la vie |
| pt | Sua tatuagem daqui a 50 anos | Na sua pele, antes que seja para sempre |
| it | Il tuo tatuaggio tra 50 anni | Sulla tua pelle, prima che sia per sempre |
| nl | Je tattoo over 50 jaar | Op je eigen huid, voordat het voor altijd is |
| pl | Twój tatuaż za 50 lat | Na Twojej skórze, zanim będzie na zawsze |
| cs | Tvoje tetování za 50 let | Na tvé kůži, než bude navždy |
| ja | 50年後のタトゥーを見る | 一生ものになる前に、自分の肌で |
| sv | Din tatuering om 50 år | På din egen hud, innan den är för alltid |

### 2 – Bare skin → fresh tattoo (search intent: try on / see tattoo on body)

| Lang | Headline | Sub-caption |
|---|---|---|
| en | Try it on your body | Any design, your photo, real size |
| hu | Próbáld fel a testeden | Bármilyen minta, a fotód, valódi méret |
| de | Probier es am Körper aus | Jedes Motiv, dein Foto, echte Größe |
| es | Pruébalo en tu cuerpo | Cualquier diseño, tu foto, tamaño real |
| fr | Essaie-le sur ton corps | N'importe quel motif, ta photo, taille réelle |
| pt | Teste no seu corpo | Qualquer desenho, sua foto, tamanho real |
| it | Provalo sul tuo corpo | Qualsiasi disegno, la tua foto, misura reale |
| nl | Pas hem op je lichaam | Elk ontwerp, jouw foto, echte grootte |
| pl | Przymierz na swoim ciele | Dowolny wzór, Twoje zdjęcie, prawdziwy rozmiar |
| cs | Vyzkoušej ho na těle | Jakýkoli motiv, tvoje fotka, skutečná velikost |
| ja | 自分の体で試着 | どんなデザインも、自分の写真で、実寸で |
| sv | Prova den på kroppen | Vilket motiv som helst, ditt foto, riktig storlek |

### 3 – 10 → 50 years, slider strip 0 · 10 · 30 · 50 (how ink really ages)

| Lang | Headline | Sub-caption |
|---|---|---|
| en | 10, 30, 50 years | Lines spread, black turns blue-grey |
| hu | 10, 30, 50 év | A vonalak szétterülnek, a fekete kékesszürke lesz |
| de | 10, 30, 50 Jahre | Linien laufen aus, Schwarz wird blaugrau |
| es | 10, 30, 50 años | Las líneas se expanden, el negro se vuelve gris azulado |
| fr | 10, 30, 50 ans | Les lignes s'étalent, le noir vire au gris-bleu |
| pt | 10, 30, 50 anos | As linhas se espalham, o preto fica cinza-azulado |
| it | 10, 30, 50 anni | Le linee si allargano, il nero vira al grigio-blu |
| nl | 10, 30, 50 jaar | Lijnen lopen uit, zwart wordt blauwgrijs |
| pl | 10, 30, 50 lat | Linie się rozlewają, czerń staje się niebieskoszara |
| cs | 10, 30, 50 let | Linky se rozpíjejí, černá šedne do modra |
| ja | 10年・30年・50年 | 線はにじみ、黒は青みがかったグレーに |
| sv | 10, 30, 50 år | Linjer flyter ut, svart blir blågrått |

### 4 – Your existing tattoo → 50 years

| Lang | Headline | Sub-caption |
|---|---|---|
| en | Already inked? | See how your tattoo will age |
| hu | Már van tetoválásod? | Nézd meg, hogyan öregszik |
| de | Schon tätowiert? | Sieh, wie dein Tattoo altert |
| es | ¿Ya tienes un tatuaje? | Mira cómo va a envejecer |
| fr | Déjà tatoué·e ? | Vois comment ton tatouage va vieillir |
| pt | Já tem tatuagem? | Veja como ela vai envelhecer |
| it | Hai già un tatuaggio? | Guarda come invecchierà |
| nl | Al een tattoo? | Zie hoe hij gaat verouderen |
| pl | Masz już tatuaż? | Zobacz, jak się zestarzeje |
| cs | Už máš tetování? | Podívej se, jak zestárne |
| ja | もうタトゥーがある？ | これからの経年変化をチェック |
| sv | Redan tatuerad? | Se hur din tatuering åldras |

### 5 – Today → after 10 laser sessions (laser tattoo removal preview)

| Lang | Headline | Sub-caption |
|---|---|---|
| en | Laser removal preview | After 3, 6 and 10 sessions – an honest estimate |
| hu | Lézeres eltávolítás előnézete | 3, 6 és 10 kezelés után – őszinte becslés |
| de | Vorschau: Laser-Entfernung | Nach 3, 6 und 10 Sitzungen – ehrlich geschätzt |
| es | Vista previa del láser | Tras 3, 6 y 10 sesiones: una estimación honesta |
| fr | Aperçu du détatouage laser | Après 3, 6 et 10 séances : une estimation honnête |
| pt | Prévia da remoção a laser | Depois de 3, 6 e 10 sessões: uma estimativa honesta |
| it | Anteprima rimozione laser | Dopo 3, 6 e 10 sedute: una stima onesta |
| nl | Voorbeeld laserverwijdering | Na 3, 6 en 10 behandelingen – een eerlijke schatting |
| pl | Podgląd usuwania laserem | Po 3, 6 i 10 zabiegach – uczciwa prognoza |
| cs | Náhled odstranění laserem | Po 3, 6 a 10 sezeních – poctivý odhad |
| ja | レーザー除去をプレビュー | 3回・6回・10回後の正直な予測 |
| sv | Förhandsvisa laserborttagning | Efter 3, 6 och 10 behandlingar – en ärlig uppskattning |

### 6 – Fine-line rose fresh → 50 years + longevity score (decide before you book)

| Lang | Headline | Sub-caption |
|---|---|---|
| en | Will it still look sharp? | Longevity score, compare, ask friends |
| hu | Éles marad évek múlva is? | Tartóssági pontszám, összehasonlítás, szavazás |
| de | Bleibt es scharf? | Haltbarkeits-Score, Vergleich, Freunde fragen |
| es | ¿Seguirá viéndose nítido? | Puntuación de durabilidad, compara, pregunta a amigos |
| fr | Restera-t-il net ? | Score de tenue, comparaison, avis des amis |
| pt | Vai continuar nítida? | Nota de durabilidade, compare, pergunte aos amigos |
| it | Resterà nitido? | Punteggio di durata, confronto, voto degli amici |
| nl | Blijft hij scherp? | Houdbaarheidsscore, vergelijken, vrienden laten stemmen |
| pl | Czy zostanie wyraźny? | Wynik trwałości, porównanie, głos znajomych |
| cs | Zůstane ostré? | Skóre trvanlivosti, porovnání, hlasování přátel |
| ja | 何年たってもくっきり？ | 長持ちスコア、比較、友だちに投票 |
| sv | Håller den sig skarp? | Hållbarhetsbetyg, jämför, låt vänner rösta |

## Notes

- Shot 2 and shot 5 need one new app run each (one try-on preview; one removal run, which makes 3 images for
  3/6/10 sessions). Check the image cost/credits before running them.
- The pairs are the same in every language; only the captions change. Long headlines (de/fr/pt/nl/sv shot 5,
  es shot 6) need a slightly smaller font or two lines – check them in the 1080-wide Play frame.
- Play feature graphic (1024×500): reuse pair 1 side by side with the en/local headline of shot 1.
- Upload order in both stores = the numbers above. On Google Play the first three are visible in search on most
  phones, so 1–3 carry the three search themes: aging, try-on, years.
