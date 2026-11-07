'use client';
import { tx, type Lang } from '@/lib/tr';
import { webPaymentsOn } from '@/lib/pricing';
import { countCta } from '@/lib/track';
import { TryLink } from '../../AuthCta';
import { StageSlider } from '../../_landing/StageSlider';

/** The way in from a public article: a tattoo fresh and aged, what you get, and one button. Removal articles talk about removal. */
export function ArticleCta({ slug, lang, where, removal }: { slug: string; lang: Lang; where: 'top' | 'mid' | 'end'; removal: boolean }) {
  const T = (en: string, hu: string) => tx(lang, en, hu);
  return (
    <aside className={`ka-join ka-join-${where}`}>
      {/* the top card: a real example to drag through before anything is asked */}
      {where === 'top' && !removal ? (
        <StageSlider t={T} where={`article:${slug}`} compact />
      ) : (
      <div className={`ka-join-pics ${removal ? 'one' : ''}`} aria-hidden="true">
        {removal ? (
          <img src="/img/hf_20261013_094405_e4565f7f-7e3b-459b-a9b4-b763da2af205-480.webp" alt="" loading="lazy" decoding="async" />
        ) : (
          <>
            <img src="/img/hf_20261013_200843_f699cd39-8d0a-43e3-9ba7-71b494279840-480.webp" alt="" loading="lazy" decoding="async" />
            <img src="/img/hf_20261013_200913_5ffd13b1-e537-4454-bb4c-495a2921afcc-480.webp" alt="" loading="lazy" decoding="async" />
          </>
        )}
      </div>
      )}
      <div className="ka-join-txt">
        <b>{removal ? T('Know what removal looks like.', 'Tudd, hogyan néz ki az eltávolítás.') : T('Wondering how yours would age?', 'Kíváncsi vagy, a tiéd hogyan öregedne?')}</b>
        <p>
          {removal
            ? T('A laser removal preview after 3, 6 and 10 sessions helps you set realistic expectations — before you talk to a clinic.', 'A 3, 6 és 10 kezelés utáni lézeres előnézet segít reális elvárásokat kialakítani – még mielőtt klinikával beszélnél.')
            : T('Upload a photo and see any design on your skin at 10, 30 and 50 years.', 'Tölts fel egy fotót, és nézd meg bármelyik mintát a bőrödön 10, 30 és 50 év múlva.')}
        </p>
      </div>
      <TryLink lang={lang} className="ka-join-go" to={removal ? '/app?mode=removal' : '/app?start=1'} onClick={() => countCta(`article_${where}`, slug)}>
        {T('Try it on my photo', 'Kipróbálom a fotómon')}
      </TryLink>
      <small>{(webPaymentsOn ? T('One-tap sign-up with Google or Apple · One preview to try · About a minute', 'Egy koppintásos Google- vagy Apple-regisztráció · Egy előnézet kipróbálásra · Kb. egy perc') : T('One-tap sign-up with Google or Apple · 30 previews a month · About a minute', 'Egy koppintásos Google- vagy Apple-regisztráció · Havi 30 előnézet · Kb. egy perc'))}</small>
    </aside>
  );
}

/** The side rail's button on a public article. */
export function ArticleRailLink({ slug, lang, children }: { slug: string; lang: Lang; children: React.ReactNode }) {
  return (
    <TryLink lang={lang} onClick={() => countCta('article_rail', slug)}>
      {children}
    </TryLink>
  );
}
