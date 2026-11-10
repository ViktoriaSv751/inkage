'use client';
import { tx, type Lang } from '@/lib/tr';
import { webPaymentsOn } from '@/lib/pricing';
import { countCta } from '@/lib/track';
import { TryLink } from '../../AuthCta';
import { StageSlider } from '../../_landing/StageSlider';

/** The way in from a public article: a tattoo fresh and aged, what you get, and one button. Removal articles talk about removal. */
export function ArticleCta({ slug, lang, where, removal, topic = '' }: { slug: string; lang: Lang; where: 'top' | 'mid' | 'end'; removal: boolean; topic?: string }) {
  const T = (en: string, hu: string) => tx(lang, en, hu);
  /* the pitch follows what the reader came for: a style, a body area, healing, or the general aging question */
  const pitch: [string, string] = removal
    ? [T('Know what removal looks like.', 'Tudd, hogyan néz ki az eltávolítás.'), T('A laser removal preview after 3, 6 and 10 sessions helps you set realistic expectations — before you talk to a clinic.', 'A 3, 6 és 10 kezelés utáni lézeres előnézet segít reális elvárásokat kialakítani – még mielőtt klinikával beszélnél.')]
    : topic === 'Styles' || topic === 'Ink'
      ? [T('See this style on your own skin.', 'Nézd meg ezt a stílust a saját bőrödön.'), T('Upload a photo, add a design in this style and see how it looks fresh and after 10, 30 and 50 years.', 'Tölts fel egy fotót, adj hozzá egy ilyen stílusú mintát, és nézd meg, hogyan néz ki frissen, valamint 10, 30 és 50 év múlva.')]
      : topic === 'Placement' || topic === 'Size'
        ? [T('Try the spot before the needle does.', 'Próbáld ki a helyet, mielőtt a tű teszi.'), T('Photograph the exact place, set the design at real size in centimetres, and see how it ages there.', 'Fotózd le pontosan azt a helyet, tedd rá a mintát valós méretben, centiben, és nézd meg, hogyan öregszik ott.')]
        : topic === 'Care'
          ? [T('Planning the next one?', 'A következőt tervezed?'), T('See how a new design would heal and age on your skin before you book.', 'Nézd meg, hogyan gyógyulna és öregedne egy új minta a bőrödön, mielőtt időpontot foglalsz.')]
          : [T('Wondering how yours would age?', 'Kíváncsi vagy, a tiéd hogyan öregedne?'), T('Upload a photo and see any design on your skin at 10, 30 and 50 years.', 'Tölts fel egy fotót, és nézd meg bármelyik mintát a bőrödön 10, 30 és 50 év múlva.')];
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
        <b>{pitch[0]}</b>
        <p>{pitch[1]}</p>
      </div>
      <TryLink lang={lang} className="ka-join-go" to={removal ? '/app?mode=removal' : '/app?start=1'} onClick={() => countCta(`article_${where}`, slug)}>
        {T('Try it on my photo', 'Kipróbálom a fotómon')}
      </TryLink>
      <small>{(webPaymentsOn ? T('One-tap sign-up with Google or Apple · One-time packages, no subscription · About a minute', 'Egy koppintásos Google- vagy Apple-regisztráció · Egyszeri csomagok, nincs előfizetés · Kb. egy perc') : T('One-tap sign-up with Google or Apple · 30 previews a month · About a minute', 'Egy koppintásos Google- vagy Apple-regisztráció · Havi 30 előnézet · Kb. egy perc'))}</small>
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
