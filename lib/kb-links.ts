// Internal links between knowledge-base articles and the style × body-area pages.
//
// Every article lists the articles it should link to, most related first. The first one is the topic's main article
// (hub) unless the article is the hub itself, so each topic's pages all point up to it and it points down to each of
// them. Topics: removal (hub laser-tattoo-removal-what-to-expect), healing & care (tattoo-healing-stages), ageing
// (how-tattoos-age), planning a first tattoo (first-tattoo-checklist).
//
// The article page uses the list three ways: two "Read also" lines between its sections, then the "More from the
// knowledge base" cards. Only articles written in the reader's language are linked (lib/article-langs.ts), so a
// link never leads to an English, noindex copy.

export const ARTICLE_LINKS: Record<string, string[]> = {
  // removal
  'laser-tattoo-removal-what-to-expect': ['laser-removal-how-many-sessions', 'laser-removal-before-after', 'laser-removal-healing', 'color-vs-black-ink-aging', 'tattoo-blowout', 'tattoo-touch-ups'],
  'laser-removal-how-many-sessions': ['laser-tattoo-removal-what-to-expect', 'laser-removal-before-after', 'laser-removal-healing', 'color-vs-black-ink-aging', 'tattoos-on-darker-skin'],
  'laser-removal-before-after': ['laser-tattoo-removal-what-to-expect', 'laser-removal-how-many-sessions', 'laser-removal-healing', 'tattoo-before-and-after', 'color-vs-black-ink-aging'],
  'laser-removal-healing': ['laser-tattoo-removal-what-to-expect', 'laser-removal-how-many-sessions', 'tattoo-healing-stages', 'sunburned-tattoo', 'laser-removal-before-after'],
  // healing & care
  'tattoo-healing-stages': ['tattoo-aftercare-sun-protection', 'sunburned-tattoo', 'tattoo-touch-ups', 'laser-removal-healing', 'tattoo-blowout', 'first-tattoo-checklist'],
  'tattoo-aftercare-sun-protection': ['tattoo-healing-stages', 'sunburned-tattoo', 'how-tattoos-age', 'tattoo-touch-ups', 'color-vs-black-ink-aging'],
  'sunburned-tattoo': ['tattoo-healing-stages', 'tattoo-aftercare-sun-protection', 'how-tattoos-age', 'laser-removal-healing', 'tattoos-on-darker-skin'],
  'tattoo-touch-ups': ['tattoo-healing-stages', 'how-tattoos-age', 'tattoo-before-and-after', 'laser-removal-before-after', 'tattoos-when-you-get-old'],
  'tattoo-blowout': ['tattoo-healing-stages', 'fine-line-tattoos-aging', 'tattoo-touch-ups', 'laser-tattoo-removal-what-to-expect', 'first-tattoo-checklist'],
  // ageing
  'how-tattoos-age': ['tattoo-before-and-after', 'tattoos-that-age-well', 'tattoos-when-you-get-old', 'color-vs-black-ink-aging', 'best-placement-for-tattoo-longevity', 'tattoo-aftercare-sun-protection'],
  'tattoo-before-and-after': ['how-tattoos-age', 'tattoos-that-age-well', 'laser-removal-before-after', 'tattoos-when-you-get-old', 'fine-line-tattoos-aging', 'tattoo-touch-ups'],
  'tattoos-that-age-well': ['how-tattoos-age', 'tattoo-before-and-after', 'tattoos-when-you-get-old', 'blackwork-tattoos-placement', 'color-vs-black-ink-aging', 'fine-line-tattoos-aging'],
  'tattoos-when-you-get-old': ['how-tattoos-age', 'tattoo-before-and-after', 'tattoos-weight-change-pregnancy', 'tattoo-touch-ups', 'tattoos-that-age-well'],
  'color-vs-black-ink-aging': ['how-tattoos-age', 'tattoos-that-age-well', 'tattoos-on-darker-skin', 'blackwork-tattoos-placement', 'laser-tattoo-removal-what-to-expect'],
  'tattoos-weight-change-pregnancy': ['how-tattoos-age', 'tattoos-when-you-get-old', 'best-placement-for-tattoo-longevity', 'tattoo-touch-ups', 'tattoo-before-and-after'],
  'tattoos-on-darker-skin': ['how-tattoos-age', 'color-vs-black-ink-aging', 'laser-removal-before-after', 'tattoos-weight-change-pregnancy', 'tattoo-healing-stages'],
  // planning a first tattoo
  'first-tattoo-checklist': ['tattoo-pain-chart', 'tattoo-size-guide', 'best-placement-for-tattoo-longevity', 'tattoo-healing-stages', 'tattoos-that-age-well', 'tattoo-aftercare-sun-protection'],
  'tattoo-pain-chart': ['first-tattoo-checklist', 'best-placement-for-tattoo-longevity', 'hand-and-finger-tattoos', 'tattoo-healing-stages', 'tattoo-size-guide'],
  'tattoo-size-guide': ['first-tattoo-checklist', 'fine-line-tattoos-aging', 'best-placement-for-tattoo-longevity', 'how-tattoos-age', 'tattoos-that-age-well'],
  'best-placement-for-tattoo-longevity': ['first-tattoo-checklist', 'tattoo-pain-chart', 'hand-and-finger-tattoos', 'tattoos-weight-change-pregnancy', 'blackwork-tattoos-placement', 'tattoo-size-guide'],
  'hand-and-finger-tattoos': ['first-tattoo-checklist', 'best-placement-for-tattoo-longevity', 'tattoo-pain-chart', 'fine-line-tattoos-aging', 'tattoo-touch-ups', 'tattoo-blowout'],
  'fine-line-tattoos-aging': ['first-tattoo-checklist', 'tattoos-that-age-well', 'tattoo-size-guide', 'tattoo-blowout', 'tattoo-before-and-after', 'blackwork-tattoos-placement'],
  'blackwork-tattoos-placement': ['first-tattoo-checklist', 'tattoos-that-age-well', 'best-placement-for-tattoo-longevity', 'tattoo-pain-chart', 'color-vs-black-ink-aging', 'fine-line-tattoos-aging'],
};

/** The style whose ten body-area pages (/tattoo/<style>-<area>) an article links to. Removal and care articles have none. */
export const ARTICLE_STYLE: Record<string, string> = {
  'fine-line-tattoos-aging': 'fine-line',
  'tattoo-size-guide': 'fine-line',
  'tattoo-blowout': 'fine-line',
  'best-placement-for-tattoo-longevity': 'fine-line',
  'blackwork-tattoos-placement': 'blackwork',
  'tattoo-pain-chart': 'blackwork',
  'color-vs-black-ink-aging': 'color',
  'tattoos-on-darker-skin': 'color',
  'tattoos-that-age-well': 'traditional',
  'hand-and-finger-tattoos': 'traditional',
  'tattoo-before-and-after': 'realism',
  'how-tattoos-age': 'realism',
  'first-tattoo-checklist': 'realism',
};

/** The articles a style × body-area page links to: the style's own articles, then the body area's, then placement in general. */
const STYLE_ARTICLES: Record<string, string[]> = {
  'fine-line': ['fine-line-tattoos-aging', 'tattoo-size-guide', 'tattoo-blowout'],
  blackwork: ['blackwork-tattoos-placement', 'tattoos-that-age-well', 'color-vs-black-ink-aging'],
  traditional: ['tattoos-that-age-well', 'how-tattoos-age', 'tattoo-touch-ups'],
  color: ['color-vs-black-ink-aging', 'tattoos-on-darker-skin', 'tattoo-aftercare-sun-protection'],
  realism: ['tattoo-before-and-after', 'how-tattoos-age', 'tattoo-touch-ups'],
};
const AREA_ARTICLES: Record<string, string[]> = { hand: ['hand-and-finger-tattoos'], finger: ['hand-and-finger-tattoos'] };

export function seoPageArticles(style: string, area: string): string[] {
  const all = [...(STYLE_ARTICLES[style] || []), ...(AREA_ARTICLES[area] || []), 'best-placement-for-tattoo-longevity', 'tattoo-pain-chart', 'tattoo-healing-stages'];
  return all.filter((s, i) => all.indexOf(s) === i);
}

/** The articles named in the footer and featured on the home page, most searched first (Search Console, 2026-11). */
export const TOP_ARTICLES = ['tattoo-before-and-after', 'laser-tattoo-removal-what-to-expect', 'tattoo-healing-stages', 'tattoo-pain-chart', 'how-tattoos-age', 'laser-removal-how-many-sessions', 'fine-line-tattoos-aging', 'first-tattoo-checklist'];
