// Languages and translation, usable on the server and in the browser.
// The code keeps writing English + Hungarian side by side; every other language is looked up
// by its English text in a dictionary (lib/locales/<lang>.json).

import READY from './locales/ready.json';

export const LANGS = ['hu', 'en', 'de', 'es', 'pt', 'fr', 'it', 'pl', 'tr', 'ro', 'nl', 'sv', 'cs', 'el', 'uk', 'ja', 'ko', 'id', 'th', 'zh'] as const;
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
  nl: { native: 'Nederlands', en: 'Dutch', hu: 'Holland', locale: 'nl-NL', flag: '🇳🇱' },
  sv: { native: 'Svenska', en: 'Swedish', hu: 'Svéd', locale: 'sv-SE', flag: '🇸🇪' },
  cs: { native: 'Čeština', en: 'Czech', hu: 'Cseh', locale: 'cs-CZ', flag: '🇨🇿' },
  el: { native: 'Ελληνικά', en: 'Greek', hu: 'Görög', locale: 'el-GR', flag: '🇬🇷' },
  uk: { native: 'Українська', en: 'Ukrainian', hu: 'Ukrán', locale: 'uk-UA', flag: '🇺🇦' },
  ja: { native: '日本語', en: 'Japanese', hu: 'Japán', locale: 'ja-JP', flag: '🇯🇵' },
  ko: { native: '한국어', en: 'Korean', hu: 'Koreai', locale: 'ko-KR', flag: '🇰🇷' },
  id: { native: 'Bahasa Indonesia', en: 'Indonesian', hu: 'Indonéz', locale: 'id-ID', flag: '🇮🇩' },
  th: { native: 'ไทย', en: 'Thai', hu: 'Thai', locale: 'th-TH', flag: '🇹🇭' },
  zh: { native: '繁體中文', en: 'Chinese (Traditional)', hu: 'Kínai (hagyományos)', locale: 'zh-TW', flag: '🇹🇼' },
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
  const v = String(nav || '').toLowerCase().trim();
  const two = v.slice(0, 2);
  // Chinese: traditional for Taiwan / Hong Kong / Macau only (simplified is not offered yet)
  if (two === 'zh') return /^zh[-_](tw|hk|mo|hant)/.test(v) && (READY as string[]).includes('zh') ? 'zh' : 'en';
  return isLang(two) && (READY as string[]).includes(two) ? two : 'en';
};

type Dict = { exact: Record<string, string>; tpl?: [string, string][] };
// kept on globalThis: on the server the same dictionaries serve every bundle (pages, client-component SSR, API)
const G = globalThis as any;
const DICTS: Partial<Record<Lang, Dict>> = (G.__inkDicts ||= {});
const compiled: Partial<Record<Lang, { re: RegExp; to: string }[]>> = (G.__inkTpl ||= {});
const cache: Partial<Record<Lang, Map<string, string>>> = (G.__inkCache ||= {});

export function registerDict(lang: Lang, d: Dict) {
  DICTS[lang] = d;
  compiled[lang] = (d.tpl || []).map(([from, to]) => ({
    re: new RegExp('^' + from.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\\?\{(\d+)\\?\}/g, '([\\s\\S]*?)') + '$'),
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

// in the browser the page ships its language's dictionary (public/locales/<lang>.js), before the app starts
if (typeof window !== 'undefined') {
  const w = window as any;
  if (w.__INK_DICT && isLang(w.__INK_LANG) && !DICTS[w.__INK_LANG as Lang]) registerDict(w.__INK_LANG, w.__INK_DICT);
}
