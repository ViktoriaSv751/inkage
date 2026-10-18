// Languages and translation, usable on the server and in the browser.
// The code keeps writing English + Hungarian side by side; every other language is looked up
// by its English text in a dictionary (lib/locales/<lang>.json).

export const LANGS = ['hu', 'en', 'de', 'es', 'pt', 'fr', 'it', 'pl', 'tr', 'ro'] as const;
export type Lang = (typeof LANGS)[number];

export const LANG_INFO: Record<Lang, { native: string; en: string; hu: string; locale: string; flag: string }> = {
  hu: { native: 'Magyar', en: 'Hungarian', hu: 'Magyar', locale: 'hu-HU', flag: '🇭🇺' },
  en: { native: 'English', en: 'English', hu: 'Angol', locale: 'en-GB', flag: '🇬🇧' },
  de: { native: 'Deutsch', en: 'German', hu: 'Német', locale: 'de-DE', flag: '🇩🇪' },
  es: { native: 'Español', en: 'Spanish', hu: 'Spanyol', locale: 'es-ES', flag: '🇪🇸' },
  pt: { native: 'Português (Brasil)', en: 'Portuguese (Brazil)', hu: 'Portugál (brazil)', locale: 'pt-BR', flag: '🇧🇷' },
  fr: { native: 'Français', en: 'French', hu: 'Francia', locale: 'fr-FR', flag: '🇫🇷' },
  it: { native: 'Italiano', en: 'Italian', hu: 'Olasz', locale: 'it-IT', flag: '🇮🇹' },
  pl: { native: 'Polski', en: 'Polish', hu: 'Lengyel', locale: 'pl-PL', flag: '🇵🇱' },
  tr: { native: 'Türkçe', en: 'Turkish', hu: 'Török', locale: 'tr-TR', flag: '🇹🇷' },
  ro: { native: 'Română', en: 'Romanian', hu: 'Román', locale: 'ro-RO', flag: '🇷🇴' },
};

export const isLang = (x: unknown): x is Lang => typeof x === 'string' && (LANGS as readonly string[]).includes(x);
/** Language from a page's ?lang= (Hungarian when missing). */
export const langOf = (sp?: { lang?: string | string[] } | null): Lang => {
  const v = Array.isArray(sp?.lang) ? sp?.lang[0] : sp?.lang;
  return isLang(v) ? v : 'hu';
};
/** The ?lang= suffix for links (none for Hungarian, the default). */
export const qOf = (lang: Lang) => (lang === 'hu' ? '' : `?lang=${lang}`);
/** Same, to append to a link that already has a query string. */
export const ampOf = (lang: Lang) => (lang === 'hu' ? '' : `&lang=${lang}`);
export const localeOf = (lang: Lang) => LANG_INFO[lang]?.locale || 'en-GB';
/** Best match for a browser language ("de-AT" → de), English otherwise. */
export const fromBrowser = (nav?: string | null): Lang => {
  const two = String(nav || '').toLowerCase().slice(0, 2);
  return isLang(two) ? two : 'en';
};

type Dict = { exact: Record<string, string>; tpl?: [string, string][] };
const DICTS: Partial<Record<Lang, Dict>> = {};
const compiled: Partial<Record<Lang, { re: RegExp; to: string }[]>> = {};
const cache: Partial<Record<Lang, Map<string, string>>> = {};

export function registerDict(lang: Lang, d: Dict) {
  DICTS[lang] = d;
  compiled[lang] = (d.tpl || []).map(([from, to]) => ({
    re: new RegExp('^' + from.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\\?\{(\d+)\\?\}/g, '([\\s\\S]+?)') + '$'),
    to,
  }));
  cache[lang] = new Map();
}
export const hasDict = (lang: Lang) => lang === 'en' || lang === 'hu' || !!DICTS[lang];

/** English text → the given language (English when no translation is known). */
export function tr(lang: Lang, en: string): string {
  if (lang === 'en' || lang === 'hu' || !en) return en;
  const d = DICTS[lang];
  if (!d) return en;
  const hit = d.exact[en];
  if (hit !== undefined) return hit;
  const c = cache[lang]!;
  const got = c.get(en);
  if (got !== undefined) return got;
  let out = en;
  // trimmed / case variants ("Inner forearm" vs "inner forearm")
  const trimmed = en.trim();
  if (trimmed !== en && d.exact[trimmed] !== undefined) out = en.replace(trimmed, d.exact[trimmed]);
  else {
    for (const { re, to } of compiled[lang] || []) {
      const m = re.exec(en);
      if (!m) continue;
      out = to.replace(/\{(\d+)\}/g, (_, i) => {
        const v = m[Number(i) + 1] ?? '';
        return d.exact[v] ?? lower(d, v) ?? v;
      });
      break;
    }
  }
  if (c.size < 5000) c.set(en, out);
  return out;
}
const lower = (d: Dict, v: string) => {
  if (!v || v.length > 60) return undefined;
  const cap = v.charAt(0).toUpperCase() + v.slice(1);
  const t = d.exact[cap];
  return t === undefined ? undefined : t;
};

/** Pick between English and Hungarian (and translate for the other languages). */
export const tx = (lang: Lang, en: string, hu: string) => (lang === 'hu' ? hu : lang === 'en' ? en : tr(lang, en));

/** For {en, hu} content objects (strings or arrays of strings). */
export function pick<T extends string | string[] | readonly string[]>(o: { en: T; hu: T } & Partial<Record<string, any>>, lang: Lang): T {
  if (lang === 'hu') return o.hu;
  if (lang === 'en') return o.en;
  if (o[lang] !== undefined) return o[lang];
  return (Array.isArray(o.en) ? (o.en as string[]).map((s) => tr(lang, s)) : tr(lang, o.en as string)) as T;
}
