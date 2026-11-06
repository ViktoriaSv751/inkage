import type { Lang } from './tr';

/** The languages the tool landing pages (/tattoo-simulator, /tattoo-aging-simulator) are written in. The other
    languages would show the English text, so they stay out of hreflang, the index and the site's links to them. */
export const TOOL_LANGS: readonly Lang[] = ['hu', 'en', 'de', 'es', 'fr', 'pt', 'it', 'nl', 'pl', 'cs', 'ja', 'sv'];

/** English titles of the tool pages: the key that decides which languages are indexable (see toolLangs). */
export const TOOL_TITLE = {
  '/tattoo-simulator': 'Tattoo simulator: see a tattoo on your own body before you get it',
  '/tattoo-aging-simulator': 'Tattoo aging simulator: see how your tattoo will age',
} as const;
