'use client';
import { useApp } from '../../../AppProvider';
import { Sheet } from '../../../ui';
import { prepareImage } from '@/lib/client';
import { uploads } from '@/lib/uploads';
import { processDesign } from '@/lib/editor';
import type { Design, Layer } from '../types';
import { L } from '../utils';

/** "Add another tattoo": upload a picture, copy one already on the photo, or pick a saved upload. */
export function AddLayerSheet({
  addOpen,
  setAddOpen,
  addBusy,
  addRef,
  design0,
  addLayer,
  layers,
  duplicateLayer,
  myDesigns,
  addSaved,
}: {
  addOpen: boolean;
  setAddOpen: (o: boolean) => void;
  addBusy: boolean;
  addRef: React.RefObject<HTMLInputElement>;
  design0: Design;
  addLayer: (raw: string, fromPhoto: boolean) => Promise<void>;
  layers: Layer[];
  duplicateLayer: (i: number) => void;
  myDesigns: { id: string; src: string }[];
  addSaved: (src: string) => void;
}) {
  const { ui, toast, me } = useApp();
  const t = L(ui.lang);
  return (
    <Sheet open={addOpen} onClose={() => !addBusy && setAddOpen(false)} label={t('Add another tattoo', 'Még egy tetoválás')}>
      <h2>{t('Add another tattoo', 'Még egy tetoválás')}</h2>
      <p className="sub">{t('It goes on the same photo – drag it above, below or next to the first one.', 'Ugyanarra a fotóra kerül – húzd a másik fölé, alá vagy mellé.')}</p>
      <input
        ref={addRef}
        id="add-layer-input"
        disabled={addBusy}
        className="file-hidden"
        type="file"
        accept="image/*,.heic,.heif"
        tabIndex={-1}
        aria-hidden="true"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          try {
            const pimg = await prepareImage(f, 1024, 'image/jpeg');
            if (me.user) void uploads.add(me.user.id, 'design', pimg.dataUrl, pimg.w, pimg.h);
            const probe = await processDesign(pimg.dataUrl, design0.mode).catch(() => null);
            await addLayer(pimg.dataUrl, !!probe?.photoLike);
          } catch {
            toast(t('That file could not be opened.', 'Ezt a fájlt nem sikerült megnyitni.'));
          }
        }}
      />
      <label htmlFor="add-layer-input" role="button" tabIndex={0} className={`btn wide ${addBusy ? 'is-busy' : ''}`} aria-disabled={addBusy} style={{ cursor: 'pointer' }}>
        {addBusy ? t('Cutting it out…', 'Kivágás…') : t('Upload a picture', 'Kép feltöltése')}
      </label>
      <p className="layer-lib-h">{t('Copy one that is already on the photo', 'Egy már fent lévő másolása')}</p>
      <div className="layer-lib">
        {layers.map((L1, i) => (
          <button key={`l${i}`} type="button" disabled={addBusy} onClick={() => duplicateLayer(i)} aria-label={t(`Duplicate tattoo ${i + 1}`, `${i + 1}. tetoválás duplikálása`)}>
            <img src={L1.design.ink} alt="" />
          </button>
        ))}
      </div>
      {myDesigns.length > 0 && (
        <>
          <p className="layer-lib-h">{t('Your uploads', 'Feltöltött mintáid')}</p>
          <div className="layer-lib">
            {myDesigns.map((d) => (
              <button key={d.id} type="button" disabled={addBusy} onClick={() => addSaved(d.src)} aria-label={t('Your uploaded design', 'Feltöltött mintád')}>
                <img src={d.src} alt="" loading="lazy" />
              </button>
            ))}
          </div>
        </>
      )}
    </Sheet>
  );
}
