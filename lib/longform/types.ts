// Long-form knowledge base articles (Tudástár). One file per article in this folder.
//
// Body markup — one array entry per block:
//   '## Heading'            section heading (goes into the table of contents)
//   '### Subheading'        smaller heading inside a section
//   '- text'                bullet item (consecutive entries form one list)
//   '1. text'               numbered item (consecutive entries form one list)
//   '> text'                highlighted tip / callout box
//   '!! text'               pull quote (one strong sentence, shown large)
//   '[[img2]]' … '[[img7]]'  where the article's inline photos go (each exactly once; img5–img7 optional)
//   anything else          a normal paragraph; **double asterisks** make bold text
export type L2 = { en: string; hu: string };

export type LongArticle = {
  slug: string;
  tag: L2; // category, e.g. { en: 'Basics', hu: 'Alapok' }
  title: L2;
  desc: L2; // one-sentence teaser (max ~140 characters)
  summary: { en: string[]; hu: string[] }; // "In short": 3–4 key takeaways
  body: { en: string[]; hu: string[] };
  faq: { q: L2; a: L2 }[]; // 4–5 questions
  captions: { img2: L2; img3: L2; img4: L2; img5?: L2; img6?: L2; img7?: L2 }; // captions for the inline photos
};
