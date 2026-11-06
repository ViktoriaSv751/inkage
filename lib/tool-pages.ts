import '@/lib/tr-server';
import type { Metadata } from 'next';
import { hasExact, qOf, htmlLang, type Lang } from './tr';
import { SITE_URL } from './site';
import { TOOL_LANGS, TOOL_TITLE } from './tool-langs';

export { TOOL_LANGS, TOOL_TITLE };

/** The tool-page languages whose dictionary really has this page's English title. */
export const toolLangs = (titleEn: string): Lang[] => TOOL_LANGS.filter((l) => hasExact(l, titleEn));

/** Canonical + hreflang for a tool page; an untranslated language points to the English page and is noindex. */
export function toolAlternates(path: string, L: Lang, titleEn: string): Metadata {
  const langs = toolLangs(titleEn);
  const url = (l: Lang) => `${SITE_URL}${path}${qOf(l)}`;
  const languages = { ...Object.fromEntries(langs.map((l) => [htmlLang(l), url(l)])), 'x-default': url('hu') };
  return langs.includes(L)
    ? { alternates: { canonical: url(L), languages } }
    : { robots: { index: false, follow: true }, alternates: { canonical: url('en'), languages } };
}
