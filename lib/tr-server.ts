// Server side: every language's dictionary (UI + knowledge-base articles), loaded when first needed.
import { setDictLoader, type Lang } from './tr';

const merge = (a: any, b: any) => ({ exact: { ...(b.exact || {}), ...(a.exact || {}) }, tpl: [...(a.tpl || []), ...(b.tpl || [])] });
const LOAD: Partial<Record<Lang, () => any>> = {
  de: () => merge(require('./locales/de.json'), require('./locales/content-de.json')),
  es: () => merge(require('./locales/es.json'), require('./locales/content-es.json')),
  pt: () => merge(require('./locales/pt.json'), require('./locales/content-pt.json')),
  fr: () => merge(require('./locales/fr.json'), require('./locales/content-fr.json')),
  it: () => merge(require('./locales/it.json'), require('./locales/content-it.json')),
  pl: () => merge(require('./locales/pl.json'), require('./locales/content-pl.json')),
  tr: () => merge(require('./locales/tr.json'), require('./locales/content-tr.json')),
  ro: () => merge(require('./locales/ro.json'), require('./locales/content-ro.json')),
  nl: () => merge(require('./locales/nl.json'), require('./locales/content-nl.json')),
  sv: () => merge(require('./locales/sv.json'), require('./locales/content-sv.json')),
  cs: () => merge(require('./locales/cs.json'), require('./locales/content-cs.json')),
  el: () => merge(require('./locales/el.json'), require('./locales/content-el.json')),
  uk: () => merge(require('./locales/uk.json'), require('./locales/content-uk.json')),
  ja: () => merge(require('./locales/ja.json'), require('./locales/content-ja.json')),
  ko: () => merge(require('./locales/ko.json'), require('./locales/content-ko.json')),
  id: () => merge(require('./locales/id.json'), require('./locales/content-id.json')),
  th: () => merge(require('./locales/th.json'), require('./locales/content-th.json')),
  zh: () => merge(require('./locales/zh.json'), require('./locales/content-zh.json')),
  vi: () => merge(require('./locales/vi.json'), require('./locales/content-vi.json')),
  fil: () => merge(require('./locales/fil.json'), require('./locales/content-fil.json')),
  ms: () => merge(require('./locales/ms.json'), require('./locales/content-ms.json')),
  zhs: () => merge(require('./locales/zhs.json'), require('./locales/content-zhs.json')),
  da: () => merge(require('./locales/da.json'), require('./locales/content-da.json')),
  'no': () => merge(require('./locales/no.json'), require('./locales/content-no.json')),
  fi: () => merge(require('./locales/fi.json'), require('./locales/content-fi.json')),
  sk: () => merge(require('./locales/sk.json'), require('./locales/content-sk.json')),
  hr: () => merge(require('./locales/hr.json'), require('./locales/content-hr.json')),
  bg: () => merge(require('./locales/bg.json'), require('./locales/content-bg.json')),
  sl: () => merge(require('./locales/sl.json'), require('./locales/content-sl.json')),
  lt: () => merge(require('./locales/lt.json'), require('./locales/content-lt.json')),
  lv: () => merge(require('./locales/lv.json'), require('./locales/content-lv.json')),
  et: () => merge(require('./locales/et.json'), require('./locales/content-et.json')),
  sr: () => merge(require('./locales/sr.json'), require('./locales/content-sr.json')),
};
setDictLoader((lang) => LOAD[lang]?.());
export const SERVER_DICTS = true;
