import { Fragment } from 'react';

/** **bold** inside a paragraph */
export function rich(p: string) {
  return p.split(/(\*\*[^*]+\*\*)/g).map((x, i) => (x.startsWith('**') && x.endsWith('**') ? <b key={i}>{x.slice(2, -2)}</b> : <Fragment key={i}>{x}</Fragment>));
}

export type Fig = { src: string; set?: string; cap: string };

/** Renders one section's blocks: paragraphs, ### subheadings, lists, tip boxes, pull quotes and photos. */
export function Blocks({ ps, figs, tip }: { ps: string[]; figs: Record<string, Fig>; tip: string }) {
  const out: React.ReactNode[] = [];
  let i = 0;
  while (i < ps.length) {
    const p = ps[i];
    if (p.startsWith('- ') || /^\d+\. /.test(p)) {
      const ordered = !p.startsWith('- ');
      const items: string[] = [];
      while (i < ps.length && (ordered ? /^\d+\. /.test(ps[i]) : ps[i].startsWith('- '))) {
        items.push(ps[i].replace(/^(- |\d+\. )/, ''));
        i++;
      }
      const L = ordered ? 'ol' : 'ul';
      out.push(
        <L key={`l${i}`} className={ordered ? 'ka-ol' : 'ka-ul'}>
          {items.map((x, j) => (
            <li key={j}>{rich(x)}</li>
          ))}
        </L>
      );
      continue;
    }
    if (p.startsWith('### ')) out.push(<h3 key={i}>{p.slice(4)}</h3>);
    else if (p.startsWith('> '))
      out.push(
        <aside key={i} className="ka-tip">
          <span className="ka-tip-ico" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" />
            </svg>
          </span>
          <div>
            <b className="ka-tip-h">{tip}</b>
            <p>{rich(p.slice(2))}</p>
          </div>
        </aside>
      );
    else if (p.startsWith('!! '))
      out.push(
        <blockquote key={i} className="ka-pull">
          <p>{rich(p.slice(3))}</p>
        </blockquote>
      );
    else if (/^\[\[img\d\]\]$/.test(p)) {
      const f = figs[p.slice(2, -2)];
      if (f)
        out.push(
          <figure key={i} className="ka-fig">
            <img src={f.src} srcSet={f.set} sizes="(min-width: 1000px) 760px, 100vw" alt={f.cap} loading="lazy" decoding="async" />
            <figcaption>{f.cap}</figcaption>
          </figure>
        );
    } else out.push(<p key={i}>{rich(p)}</p>);
    i++;
  }
  return <>{out}</>;
}
