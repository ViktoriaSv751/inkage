'use client';
import { qOf } from '@/lib/tr';

import { useCallback, useRef, useState } from 'react';
import { useApp } from '../../../AppProvider';
import { checkPhotoOnce } from '../../../_home/photoCheck';
import { haptic, track } from '@/lib/store';
import { prepareImage } from '@/lib/client';
import { processDesign } from '@/lib/editor';
import { aiPlacement } from '@/lib/placements';
import { TattooPicker } from '../../Picker';
import { BodyMap } from '../../BodyMap';
import type { Area, CheckState, Design, Photo, Skin } from '../types';
import { L, withTimeout } from '../utils';
import { CameraSheet } from '../CameraSheet';
import { useRecentPhotos } from './useRecentPhotos';
import { useModelPhoto } from './useModelPhoto';
import { useAiDrawing } from './useAiDrawing';
import { useDesignImport } from './useDesignImport';
import { ModeSwitch } from './ModeSwitch';
import { DesignSlot, PhotoSlot, RecentPhotos } from './Slots';
import { CutCompare } from './CutCompare';
import { ExistingSize } from './ExistingSize';
import { ModelSheet } from './ModelSheet';
import { LinkSheet } from './LinkSheet';

// ================================================================ studio: photo + design on one screen

export function StudioStep({
  existingCm,
  setExistingCm,
  onArea,
  mode = 'new',
  setMode,
  placement,
  setPlacement,
  photo,
  setPhoto,
  design,
  setDesign,
  onExtras,
  onNext,
}: {
  mode?: 'new' | 'existing' | 'removal';
  setMode?: (m: 'new' | 'existing' | 'removal') => void;
  placement: string;
  setPlacement: (p: string) => void;
  photo: Photo | null;
  setPhoto: (p: Photo | null) => void;
  design: Design | null;
  setDesign: (d: Design | null) => void;
  /** more tattoos taken from the same picture: they go onto the photo next to the first one */
  onExtras?: (ds: Design[]) => void;
  onNext: () => void;
  onArea?: (a: Area | null, where: string, ph: Photo, skin?: Skin | null) => void;
  existingCm?: number | null;
  setExistingCm?: (n: number | null) => void;
}) {
  const { ui, toast } = useApp();
  const t = L(ui.lang);
  const photoRef = useRef<HTMLInputElement>(null);
  // a fresh file input after every pick: some phones stop reporting a new choice on a reused input
  const [inputKey, setInputKey] = useState(0);
  const designRef = useRef<HTMLInputElement>(null);
  const [cam, setCam] = useState(false);
  const [check, setCheck] = useState<CheckState>({ state: photo ? 'ok' : 'idle' });
  const [busy, setBusy] = useState(false);
  const [busyMsg, setBusyMsg] = useState('');
  const [over, setOver] = useState<'' | 'photo' | 'design'>('');
  const existing = mode === 'existing' || mode === 'removal';
  const removal = mode === 'removal';
  const [ideaOpen, setIdeaOpen] = useState(false);

  const usePhoto = (p: Photo) => {
    setPhoto(p);
    haptic();
    runCheck(p, placement);
  };
  const { recent, pickRecent, keep } = useRecentPhotos(photo, usePhoto);
  const model = useModelPhoto(placement, usePhoto);

  const runCheck = useCallback(
    async (p: Photo, where: string) => {
      setCheck({ state: 'checking' });
      const r = await checkPhotoOnce(p.dataUrl, aiPlacement(where));
      if (!r.ok) return setCheck({ state: 'ok' }); // never block on a failed check
      onArea?.(r.data.box ? { box: r.data.box, angle: r.data.angle ?? 0 } : null, where, p, r.data.skin);
      const c = r.data.code;
      track('photo_check', { code: c });
      if (c === 'not_allowed') return setCheck({ state: 'blocked', msg: t('We can’t use this photo. Use a photo of an adult’s arm, leg, back or similar, with no nudity.', 'Ezt a fotót nem tudjuk használni. Felnőtt karjáról, lábáról, hátáról készült, nem meztelen fotót tölts fel.') });
      if (c === 'no_skin') return setCheck({ state: 'warn', msg: t('We can’t see much bare skin. A closer shot works best.', 'Kevés csupasz bőr látszik. Egy közelebbi fotó lesz a legjobb.') });
      if (c === 'blurry') return setCheck({ state: 'warn', msg: t('A bit blurry — a sharper photo gives a much more realistic result.', 'Kicsit homályos – élesebb fotóval sokkal valósághűbb lesz.') });
      if (c === 'dark') return setCheck({ state: 'warn', msg: t('Quite dark — try near a window in daylight.', 'Elég sötét – próbáld ablak mellett, nappali fényben.') });
      setCheck({ state: 'ok', msg: t('Photo looks good', 'Jó a fotó') });
    },
    [ui.lang] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const takePhoto = async (file: File | Blob) => {
    try {
      const p = await withTimeout(prepareImage(file as File, 1024), 20000);
      setPhoto(p);
      keep('photo', p);
      haptic();
      track('photo_added');
      runCheck(p, placement);
    } catch (e) {
      const f = file as File;
      track('photo_open_error', { type: f.type || '?', ext: (f.name || '').split('.').pop()?.slice(0, 8) || '', kb: Math.round((f.size || 0) / 1024), msg: String((e as Error)?.message || e).slice(0, 120) });
      toast(t('That file could not be opened. Try a JPG, PNG or HEIC photo.', 'Ezt a fájlt nem sikerült megnyitni. JPG, PNG vagy HEIC fotó legyen.'));
    }
  };

  const applyDesign = async (raw: string, mode: Design['mode'], libId?: string) => {
    setBusy(true);
    try {
      const d = await processDesign(raw, mode);
      setDesign({ raw, ink: d.dataUrl, ratio: d.ratio, detail: d.detail, mode, libId, original: design?.raw === raw ? design?.original : undefined });
      haptic();
    } catch {
      toast(t('That design could not be opened. Try another image.', 'Ezt a mintát nem sikerült megnyitni. Próbálj másik képet.'));
    }
    setBusy(false);
  };
  useAiDrawing(design, applyDesign);
  const { linkOpen, setLinkOpen, link, setLink, linkBusy, fromLink, pick, setPick, extract, usePick, designFromFile, paste } = useDesignImport({
    design,
    setDesign,
    onExtras,
    applyDesign,
    keep,
    setBusy,
    setBusyMsg,
  });

  const drop = (kind: 'photo' | 'design') => ({
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      setOver(kind);
    },
    onDragLeave: () => setOver(''),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setOver('');
      const f = e.dataTransfer.files?.[0];
      if (!f) return;
      if (kind === 'photo') takePhoto(f);
      else designFromFile(f, 'upload');
    },
  });

  const ready = !!photo && (existing || !!design) && !busy && check.state !== 'blocked' && check.state !== 'checking';
  const cta = !photo
    ? existing ? t('Add a photo of your tattoo', 'Add hozzá a tetoválásod fotóját') : t('Add your photo', 'Add hozzá a fotódat')
    : !existing && !design
      ? t('Pick a design', 'Válassz mintát')
      : check.state === 'checking'
        ? ui.t('create.photo.checking')
        : removal
          ? t('Show the laser sessions', 'Mutasd a lézeres kezeléseket')
          : existing
          ? t('Continue', 'Tovább')
          : t('Continue — place it', 'Tovább – elhelyezés');

  return (
    <div className="studio-grid">
      <div className="col-a">
      <ModeSwitch existing={existing} removal={removal} setMode={setMode} ideaOpen={ideaOpen} setIdeaOpen={setIdeaOpen} designFromFile={designFromFile} />
      <section className="studio-sec">
        <h2 className="sec-title">{existing ? t('Where is it?', 'Hol van?') : t('Where will it go?', 'Hová kerül?')}</h2>
        <BodyMap value={placement} onChange={setPlacement} />
      </section>
      </div>
      <div className="col-b">

      <h2 className="sec-title">{existing ? t('Photo of your tattoo', 'Fotó a tetoválásodról') : t('Your photo and the design', 'A fotód és a minta')}</h2>
      <div className={`studio-slots ${existing ? 'one' : ''}`}>
        <PhotoSlot
          existing={existing}
          photo={photo}
          over={over}
          drop={drop('photo')}
          takePhoto={takePhoto}
          onClear={() => { setPhoto(null); setCheck({ state: 'idle' }); }}
          onCamera={() => setCam(true)}
          onModel={() => model.setModelOpen(true)}
        />

        {!existing && (
        <DesignSlot design={design} over={over} drop={drop('design')} busy={busy} busyMsg={busyMsg} paste={paste} onLink={() => setLinkOpen(true)} />
        )}
      </div>

      {recent.length > 0 && <RecentPhotos recent={recent} photo={photo} pickRecent={pickRecent} />}

      {photo && check.state !== 'idle' && (
        <p className={`check-line ${check.state}`} role="status">
          {check.state === 'checking' ? <i className="needle" /> : check.state === 'ok' ? '✓' : '!'}
          <span>{check.state === 'checking' ? ui.t('create.photo.checking') : check.msg || t('Photo looks good', 'Jó a fotó')}</span>
        </p>
      )}

      <p className="fine ai-note">
        {t('Your photo and design are sent to our AI providers (Google Gemini, OpenAI as backup) only to check the photo and make your preview. ', 'A fotódat és a mintádat csak az ellenőrzéshez és az előnézethez küldjük el az MI-szolgáltatóinknak (Google Gemini, tartalékként OpenAI). ')}
        {t('Only upload photos of yourself, or of someone who agreed to it. ', 'Csak saját magadról készült fotót tölts fel, vagy olyanról, aki ebbe beleegyezett. ')}
        <a href={`/privacy${qOf(ui.lang)}`}>{t('Privacy', 'Adatvédelem')}</a>
      </p>

      <input key={`p${inputKey}`} ref={photoRef} id="photo-input" className="file-hidden" type="file" accept="image/*,.heic,.heif" tabIndex={-1} aria-hidden="true" onChange={(e) => { const f = e.target.files?.[0]; setInputKey((k) => k + 1); if (f) takePhoto(f); }} />
      <input key={`d${inputKey}`} ref={designRef} id="design-input" className="file-hidden" type="file" accept="image/*,.heic,.heif" tabIndex={-1} aria-hidden="true" onChange={(e) => { const f = e.target.files?.[0]; setInputKey((k) => k + 1); if (f) designFromFile(f, 'upload'); }} />

      {!existing && design?.original && <CutCompare design={design} busy={busy} pick={pick} setPick={setPick} extract={extract} applyDesign={applyDesign} />}
      {!existing && design && !design.libId && !design.original && (
        <button className="cutbtn" onClick={() => (pick ? setPick({ ...pick, open: true }) : extract(design.raw, design.mode))} disabled={busy}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M20 4L8.1 15.9M14.5 14.5L20 20M8.1 8.1L12 12" /></svg>
          <span>
            {t('Cut out only the tattoo', 'Csak a tetoválást vágd ki')}
            <small>{t('If your picture shows a person or background', 'Ha a képen ember vagy háttér is van')}</small>
          </span>
        </button>
      )}
      {pick && (
        <TattooPicker
          key={pick.image.slice(-48)}
          open={pick.open}
          image={pick.image}
          found={pick.found}
          onPick={(bs) => usePick(bs)}
          onWhole={() => usePick(null)}
          onClose={() => setPick({ ...pick, open: false })}
        />
      )}
      {existing ? (
        <ExistingSize removal={removal} existingCm={existingCm} setExistingCm={setExistingCm} />
      ) : null}
      <p className="fine">{t('Only use designs you have the right to use — respect artists’ work.', 'Csak olyan mintát használj, amihez jogod van – tiszteld a tetoválóművészek munkáját.')}</p>

      <div className="stickycta">
        <button className="btn wide dark" disabled={!ready} onClick={onNext}>
          {check.state === 'warn' && ready ? t('Use this photo anyway', 'Mehet így is') : cta}
        </button>
      </div>

      </div>
      <ModelSheet placement={placement} {...model} />
      <LinkSheet linkOpen={linkOpen} setLinkOpen={setLinkOpen} link={link} setLink={setLink} linkBusy={linkBusy} fromLink={fromLink} />
      {cam && (
        <CameraSheet
          placement={placement}
          onClose={() => setCam(false)}
          onShot={(b) => {
            setCam(false);
            takePhoto(b);
          }}
          onFallback={() => {
            setCam(false);
            photoRef.current?.click();
          }}
        />
      )}
    </div>
  );
}
