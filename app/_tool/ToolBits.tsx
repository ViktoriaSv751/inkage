'use client';
import { tx, type Lang } from '@/lib/tr';
import { countCta } from '@/lib/track';
import { TryLink } from '../AuthCta';
import { CompareSlider } from '../_landing/Demos';
import '../landing2.css';

/** The home page's fresh-vs-50-years slider, without its big heading. */
export function ToolSlider({ lang }: { lang: Lang }) {
  return <CompareSlider t={(en, hu) => tx(lang, en, hu)} head={false} />;
}

/** The main call to action of a tool page (registration, or the app when signed in), counted like the article buttons. */
export function ToolCta({ page, lang, where, children }: { page: string; lang: Lang; where: 'top' | 'end'; children: React.ReactNode }) {
  return (
    <TryLink lang={lang} className="tl-go" onClick={() => countCta(`tool_${where}`, page)}>
      {children}
    </TryLink>
  );
}
