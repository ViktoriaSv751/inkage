'use client';
import { useApp } from '../../../AppProvider';
import { Icon } from '../../../ui';
import { isNative, nativePickPhoto } from '@/lib/native';
import { track } from '@/lib/store';
import type { Design, Photo } from '../types';
import type { Recent } from '../recent';
import { L } from '../utils';

type DropHandlers = { onDragOver: (e: React.DragEvent) => void; onDragLeave: () => void; onDrop: (e: React.DragEvent) => void };

/** Slot 1: the photo of the body (or of the existing tattoo). */
export function PhotoSlot({
  existing,
  photo,
  over,
  drop,
  takePhoto,
  onClear,
  onCamera,
  onModel,
}: {
  existing: boolean;
  photo: Photo | null;
  over: '' | 'photo' | 'design';
  drop: DropHandlers;
  takePhoto: (file: File | Blob) => void;
  onClear: () => void;
  onCamera: () => void;
  onModel: () => void;
}) {
  const { ui } = useApp();
  const t = L(ui.lang);
  return (
    <div className="studio-col">
      <label htmlFor="photo-input" role="button" tabIndex={0} className={`sslot ${photo ? 'has' : ''} ${over === 'photo' ? 'over' : ''}`} onClick={(e) => { track('photo_pick_open'); if (isNative()) { e.preventDefault(); nativePickPhoto(ui.lang).then((b) => b && takePhoto(b)); } }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); (e.currentTarget as HTMLElement).click(); } }} aria-label={t('Choose your photo', 'Fotó kiválasztása')} {...drop}>
        {photo ? <img src={photo.dataUrl} alt={t('Your photo', 'A fotód')} /> : (
          <span className="sslot-empty">
            {Icon.camera}
            <b>{existing ? t('Your tattoo', 'A tetoválásod') : t('Your photo', 'A fotód')}</b>
            <small>{existing ? t('a clear photo of it, in daylight', 'éles fotó róla, nappali fényben') : t('the body area, in daylight', 'a testrész, nappali fényben')}</small>
          </span>
        )}
        <span className="sslot-tag">1</span>
      </label>
      {photo && (
        <button type="button" className="sslot-clear" onClick={onClear} aria-label={t('Remove photo', 'Fotó eltávolítása')}>
          ×
        </button>
      )}
      <div className="sslot-btns">
        <button className="chipbtn" onClick={onCamera}>
          {Icon.camera} {t('Camera', 'Kamera')}
        </button>
        <label htmlFor="photo-input" role="button" tabIndex={0} className="chipbtn" onClick={(e) => { track('photo_pick_open'); if (isNative()) { e.preventDefault(); nativePickPhoto(ui.lang).then((b) => b && takePhoto(b)); } }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); (e.currentTarget as HTMLElement).click(); } }}>
          {Icon.image} {t('Photos', 'Galéria')}
        </label>
      </div>
      {!existing && (
        <button className="linkbtn" onClick={onModel}>
          {t('No good photo? Use a model', 'Nincs jó fotód? Használj modellt')}
        </button>
      )}
    </div>
  );
}

/** Slot 2: the design. */
export function DesignSlot({
  design,
  over,
  drop,
  busy,
  busyMsg,
  paste,
  onLink,
}: {
  design: Design | null;
  over: '' | 'photo' | 'design';
  drop: DropHandlers;
  busy: boolean;
  busyMsg: string;
  paste: () => void;
  onLink: () => void;
}) {
  const { ui } = useApp();
  const t = L(ui.lang);
  return (
    <div className="studio-col">
      <label htmlFor="design-input" role="button" tabIndex={0} className={`sslot design ${design ? 'has' : ''} ${over === 'design' ? 'over' : ''}`} onClick={() => track('design_pick_open')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); (e.currentTarget as HTMLElement).click(); } }} aria-label={t('Choose a design', 'Minta kiválasztása')} {...drop}>
        {design ? <img src={design.ink} alt={t('Your design', 'A mintád')} /> : (
          <span className="sslot-empty">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5M4 20h16" /></svg>
            <b>{t('The design', 'A minta')}</b>
            <small>{t('Screenshot, saved image, sketch', 'Képernyőfotó, mentett kép, rajz')}</small>
          </span>
        )}
        {busy && (
          <span className="sslot-busy">
            <i className="needle" />
            {busyMsg && <small>{busyMsg}</small>}
          </span>
        )}
        <span className="sslot-tag">2</span>
      </label>
      <div className="sslot-btns">
        <label htmlFor="design-input" role="button" tabIndex={0} className="chipbtn" onClick={() => track('design_pick_open')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); (e.currentTarget as HTMLElement).click(); } }}>
          {Icon.image} {t('Upload', 'Feltöltés')}
        </label>
        <button className="chipbtn" onClick={paste}>
          {Icon.clip} {t('Paste', 'Beilleszt')}
        </button>
      </div>
      <button className="linkbtn" onClick={onLink}>
        {t('From a link (Pinterest, Instagram…)', 'Linkről (Pinterest, Instagram…)')}
      </button>
    </div>
  );
}

/** The last few photos, to pick again with one tap. */
export function RecentPhotos({ recent, photo, pickRecent }: { recent: Recent[]; photo: Photo | null; pickRecent: (r: Recent) => void }) {
  const { ui } = useApp();
  const t = L(ui.lang);
  return (
    <div className="recents" aria-label={t('Recent photos', 'Legutóbbi fotóid')}>
      <span>{t('Recent', 'Legutóbbi')}</span>
      {recent.map((r, i) => (
        <button key={r.id || i} className={photo?.dataUrl.slice(-80) === r.d.slice(-80) ? 'on' : ''} onClick={() => pickRecent(r)} aria-label={t(`Recent photo ${i + 1}`, `${i + 1}. legutóbbi fotó`)}>
          <img src={r.d} alt="" />
        </button>
      ))}
    </div>
  );
}
