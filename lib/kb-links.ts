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
'tattoo-styles-guide': ['how-tattoos-age', 'tattoos-that-age-well', 'fine-line-tattoos-aging', 'blackwork-tattoos-placement', 'color-vs-black-ink-aging', 'first-tattoo-checklist'],
  'realism-tattoos-aging': ['how-tattoos-age', 'tattoos-that-age-well', 'color-vs-black-ink-aging', 'tattoo-touch-ups', 'best-placement-for-tattoo-longevity', 'tattoo-size-guide'],
  'american-traditional-tattoo-aging': ['how-tattoos-age', 'tattoos-that-age-well', 'tattoo-before-and-after', 'color-vs-black-ink-aging', 'tattoo-touch-ups', 'best-placement-for-tattoo-longevity'],
  'how-to-book-a-tattoo': ['first-tattoo-checklist', 'tattoo-size-guide', 'tattoo-pain-chart', 'best-placement-for-tattoo-longevity', 'tattoo-healing-stages', 'tattoo-touch-ups'],
  'laser-tattoo-removal-cost': ['laser-tattoo-removal-what-to-expect', 'laser-removal-how-many-sessions', 'color-vs-black-ink-aging', 'cover-up-tattoos', 'laser-removal-before-after', 'laser-removal-healing'],
  'tattoo-ink-safety-eu': ['color-vs-black-ink-aging', 'first-tattoo-checklist', 'tattoo-healing-stages', 'laser-tattoo-removal-what-to-expect', 'tattoos-on-darker-skin'],
  'laser-tattoo-removal-pain': ['laser-tattoo-removal-what-to-expect', 'laser-removal-healing', 'tattoo-pain-chart', 'laser-removal-how-many-sessions', 'laser-tattoo-removal-cost', 'color-vs-black-ink-aging'],
  'colour-tattoo-removal': ['laser-tattoo-removal-what-to-expect', 'color-vs-black-ink-aging', 'laser-removal-how-many-sessions', 'cover-up-tattoos', 'tattoos-on-darker-skin', 'laser-tattoo-removal-cost'],
  'chest-tattoos': ['rib-tattoos', 'spine-tattoos', 'neck-tattoos', 'tattoo-pain-chart', 'tattoos-weight-change-pregnancy', 'tattoo-healing-stages'],
  'spine-tattoos': ['rib-tattoos', 'neck-tattoos', 'fine-line-tattoos-aging', 'fine-line-script-tattoos', 'tattoo-pain-chart', 'tattoo-healing-stages'],
  'regret-new-tattoo': ['tattoo-healing-stages', 'tattoo-touch-ups', 'cover-up-tattoos', 'laser-tattoo-removal-what-to-expect', 'tattoo-removal-creams-diy', 'tattoo-itching-peeling'],
  'tattoo-removal-creams-diy': ['laser-tattoo-removal-what-to-expect', 'laser-tattoo-removal-cost', 'cover-up-tattoos', 'laser-removal-how-many-sessions', 'laser-removal-healing', 'laser-removal-before-after'],
  'neck-tattoos': ['best-placement-for-tattoo-longevity', 'blackwork-tattoos-placement', 'tattoo-pain-chart', 'tattoo-healing-stages', 'tattoo-aftercare-sun-protection', 'laser-tattoo-removal-cost'],
  'rib-tattoos': ['first-tattoo-checklist', 'tattoo-pain-chart', 'best-placement-for-tattoo-longevity', 'tattoos-weight-change-pregnancy', 'fine-line-tattoos-aging', 'tattoo-healing-stages'],
  'tattoo-itching-peeling': ['tattoo-healing-stages', 'tattoo-aftercare-sun-protection', 'sunburned-tattoo', 'tattoo-ink-safety-eu', 'color-vs-black-ink-aging', 'tattoo-touch-ups'],
  'how-much-does-a-tattoo-cost': ['first-tattoo-checklist', 'how-to-book-a-tattoo', 'tattoo-size-guide', 'tattoo-touch-ups', 'cover-up-tattoos', 'laser-tattoo-removal-cost'],
  'laser-removal-darker-skin': ['laser-tattoo-removal-what-to-expect', 'tattoos-on-darker-skin', 'laser-removal-how-many-sessions', 'laser-removal-healing', 'laser-tattoo-removal-summer', 'colour-tattoo-removal'],
  'first-tattoo-ideas': ['first-tattoo-checklist', 'tattoos-that-age-well', 'tattoo-size-guide', 'best-placement-for-tattoo-longevity', 'how-to-book-a-tattoo', 'tattoo-pain-chart'],
  'laser-fading-before-cover-up': ['laser-tattoo-removal-what-to-expect', 'cover-up-tattoos', 'laser-removal-how-many-sessions', 'laser-tattoo-removal-cost', 'laser-removal-healing', 'colour-tattoo-removal'],
  'eyebrow-pmu-removal': ['laser-tattoo-removal-what-to-expect', 'colour-tattoo-removal', 'tattoo-removal-creams-diy', 'laser-removal-how-many-sessions', 'laser-removal-healing', 'laser-tattoo-removal-cost'],
  'tattoo-removal-pregnancy': ['laser-tattoo-removal-what-to-expect', 'tattoos-weight-change-pregnancy', 'laser-removal-healing', 'laser-removal-how-many-sessions', 'tattoo-removal-creams-diy', 'laser-tattoo-removal-summer'],
  'fine-line-script-tattoos': ['fine-line-tattoos-aging', 'tattoo-size-guide', 'tattoo-styles-guide', 'hand-and-finger-tattoos', 'tattoo-touch-ups', 'best-placement-for-tattoo-longevity'],
  'infected-tattoo-signs': ['tattoo-healing-stages', 'tattoo-itching-peeling', 'tattoo-aftercare-sun-protection', 'tattoo-ink-safety-eu', 'first-tattoo-checklist', 'tattoo-touch-ups'],
  'japanese-tattoos': ['tattoo-styles-guide', 'american-traditional-tattoo-aging', 'tattoos-that-age-well', 'how-much-does-a-tattoo-cost', 'color-vs-black-ink-aging', 'cover-up-tattoos'],
  'tattoos-blood-donation-mri': ['first-tattoo-checklist', 'tattoo-ink-safety-eu', 'tattoo-healing-stages', 'tattoos-when-you-get-old', 'tattoo-removal-pregnancy', 'tattoo-itching-peeling'],
  'raised-tattoo': ['tattoo-healing-stages', 'tattoo-itching-peeling', 'sunburned-tattoo', 'tattoo-blowout', 'tattoo-ink-safety-eu', 'tattoos-on-darker-skin'],
  'minimalist-tattoos': ['how-tattoos-age', 'fine-line-tattoos-aging', 'tattoo-size-guide', 'tattoo-touch-ups', 'best-placement-for-tattoo-longevity', 'hand-and-finger-tattoos'],
  'ankle-tattoos': ['best-placement-for-tattoo-longevity', 'tattoo-pain-chart', 'neck-tattoos', 'tattoo-healing-stages', 'fine-line-tattoos-aging', 'tattoo-aftercare-sun-protection'],
  'watercolour-tattoos': ['tattoo-styles-guide', 'color-vs-black-ink-aging', 'tattoos-that-age-well', 'tattoo-touch-ups', 'tattoo-aftercare-sun-protection', 'best-placement-for-tattoo-longevity'],
  'behind-the-ear-tattoos': ['neck-tattoos', 'best-placement-for-tattoo-longevity', 'tattoo-pain-chart', 'fine-line-tattoos-aging', 'tattoo-healing-stages', 'tattoo-size-guide'],
  'neo-traditional-tattoos': ['tattoo-styles-guide', 'american-traditional-tattoo-aging', 'color-vs-black-ink-aging', 'tattoos-that-age-well', 'tattoo-size-guide', 'best-placement-for-tattoo-longevity'],
  'dotwork-geometric-tattoos': ['tattoo-styles-guide', 'blackwork-tattoos-placement', 'fine-line-tattoos-aging', 'tattoos-weight-change-pregnancy', 'tattoo-touch-ups', 'tattoo-size-guide'],
  'white-and-uv-ink-tattoos': ['color-vs-black-ink-aging', 'tattoo-ink-safety-eu', 'colour-tattoo-removal', 'tattoos-on-darker-skin', 'tattoo-aftercare-sun-protection', 'raised-tattoo'],
  'tattoo-age-limit': ['first-tattoo-checklist', 'how-to-book-a-tattoo', 'first-tattoo-ideas', 'tattoo-size-guide', 'best-placement-for-tattoo-longevity', 'tattoos-weight-change-pregnancy'],
  'what-to-avoid-after-a-tattoo': ['tattoo-aftercare-sun-protection', 'tattoo-healing-stages', 'first-tattoo-checklist', 'sunburned-tattoo', 'infected-tattoo-signs', 'tattoo-itching-peeling'],
  'second-skin-tattoo-film': ['tattoo-healing-stages', 'tattoo-itching-peeling', 'infected-tattoo-signs', 'tattoo-aftercare-sun-protection', 'first-tattoo-checklist', 'raised-tattoo'],
  'couple-and-name-tattoos': ['first-tattoo-ideas', 'fine-line-script-tattoos', 'cover-up-tattoos', 'tattoo-size-guide', 'minimalist-tattoos', 'laser-tattoo-removal-cost'],
  'knee-and-elbow-tattoos': ['best-placement-for-tattoo-longevity', 'tattoo-pain-chart', 'tattoo-touch-ups', 'tattoo-healing-stages', 'tattoo-blowout', 'dotwork-geometric-tattoos'],
  'tattoos-at-work': ['first-tattoo-checklist', 'neck-tattoos', 'hand-and-finger-tattoos', 'best-placement-for-tattoo-longevity', 'cover-up-tattoos', 'laser-tattoo-removal-cost'],
  'tribal-tattoos': ['tattoo-styles-guide', 'blackwork-tattoos-placement', 'cover-up-tattoos', 'laser-fading-before-cover-up', 'tattoos-that-age-well', 'japanese-tattoos'],
  'stick-and-poke-tattoos': ['tattoo-styles-guide', 'infected-tattoo-signs', 'tattoo-blowout', 'laser-tattoo-removal-what-to-expect', 'dotwork-geometric-tattoos', 'fine-line-tattoos-aging'],
  'laser-tattoo-removal-summer': ['laser-removal-healing', 'laser-removal-how-many-sessions', 'laser-tattoo-removal-what-to-expect', 'sunburned-tattoo', 'tattoos-on-darker-skin'],
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
  'realism-tattoos-aging': 'realism',
  'american-traditional-tattoo-aging': 'traditional',
  'tattoo-styles-guide': 'traditional',
  'first-tattoo-checklist': 'realism',
};

/** The articles a style × body-area page links to: the style's own articles, then the body area's, then placement in general. */
const STYLE_ARTICLES: Record<string, string[]> = {
  'fine-line': ['fine-line-tattoos-aging', 'tattoo-size-guide', 'tattoo-styles-guide'],
  blackwork: ['blackwork-tattoos-placement', 'tattoo-styles-guide', 'color-vs-black-ink-aging'],
  traditional: ['american-traditional-tattoo-aging', 'tattoos-that-age-well', 'tattoo-styles-guide'],
  color: ['color-vs-black-ink-aging', 'tattoos-on-darker-skin', 'tattoo-aftercare-sun-protection'],
  realism: ['realism-tattoos-aging', 'tattoo-before-and-after', 'tattoo-styles-guide'],
};
const AREA_ARTICLES: Record<string, string[]> = { hand: ['hand-and-finger-tattoos'], finger: ['hand-and-finger-tattoos'], neck: ['neck-tattoos'], ribs: ['rib-tattoos'], ankle: ['ankle-tattoos'] };

export function seoPageArticles(style: string, area: string): string[] {
  const all = [...(STYLE_ARTICLES[style] || []), ...(AREA_ARTICLES[area] || []), 'best-placement-for-tattoo-longevity', 'tattoo-pain-chart', 'tattoo-healing-stages'];
  return all.filter((s, i) => all.indexOf(s) === i);
}

/** The articles named in the footer and featured on the home page, most searched first (Search Console, 2026-11). */
export const TOP_ARTICLES = ['tattoo-before-and-after', 'laser-tattoo-removal-what-to-expect', 'tattoo-healing-stages', 'tattoo-pain-chart', 'how-tattoos-age', 'laser-removal-how-many-sessions', 'fine-line-tattoos-aging', 'first-tattoo-checklist'];
