import { type Lang } from '@/lib/tr';
import { tx } from '@/lib/i18n';

export const L = (lang: Lang) => (en: string, hu: string) => tx(lang, en, hu);

/** Never let a stuck image decode freeze the screen silently. */
export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('timeout')), ms);
    p.then((v) => (clearTimeout(t), res(v)), (e) => (clearTimeout(t), rej(e)));
  });
}
