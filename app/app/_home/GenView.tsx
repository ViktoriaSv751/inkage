'use client';
import { pick } from '@/lib/tr';
import { useApp } from '../AppProvider';
import { Photo } from '../create/steps';
import { tx } from '@/lib/i18n';
import { FACTS } from './constants';

/** While the preview is being made: the photo being scanned, the steps so far and a fact about aging ink. */
export function GenView({ photo, genStep, busyNote, fact }: { photo: Photo | null; genStep: number; busyNote: boolean; fact: number }) {
  const { ui } = useApp();
  const t = (en: string, hu: string) => tx(ui.lang, en, hu);
  return (
    <div className="gen" aria-busy="true">
      <h1 style={{ marginBottom: 0 }}>{t('Inking…', 'Tetoválunk…')}</h1>
      <div className="gen-visual">
        {photo && <img src={photo.dataUrl} alt="" />}
        <div className="scan" />
      </div>
      <ul className="gen-steps" role="status">
        {(['gen.s1', 'gen.s2', 'gen.s3', 'gen.s4'] as const).map((k, i) => (
          <li key={k} className={i < genStep ? 'done' : i === genStep ? 'doing' : ''}>
            <i />
            {ui.t(k)}
          </li>
        ))}
      </ul>
      {busyNote && <p className="warnbox" role="status">{t('Lots of people are making previews right now — you’re in the queue, we’ll retry automatically.', 'Most sokan készítenek előnézetet – sorban állsz, automatikusan újrapróbáljuk.')}</p>}
      <p className="gen-fact" dangerouslySetInnerHTML={{ __html: pick(FACTS, ui.lang)[fact] }} />
    </div>
  );
}
