'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useApp } from '../AppProvider';
import { Icon } from '../ui';
import { tx } from '@/lib/i18n';
import { qOf } from '@/lib/tr';
import { cloud, haptic, local, track } from '@/lib/store';
import { uploads } from '@/lib/uploads';
import { ALL_DESIGNS } from '@/lib/designs';
import { StageSlider } from '@/app/_landing/StageSlider';

export type Picked = { src: string; colorMode?: 'black' | 'color'; libId?: string; from: 'idea' | 'design' | 'preview' | 'library' };
type Tile = Picked & { key: string; thumb: string; label?: string };

/**
 * "Your designs": what the plus opens. The tattoos saved so far (ideas, uploaded designs, designs already tried on)
 * one tap away, a new design, an existing tattoo or a removal; the form comes after this.
 */
export function PickView({ onPick, onNew, onMode }: { onPick: (p: Picked) => Promise<void>; onNew: () => void; onMode: (m: 'existing' | 'removal') => void }) {
  const { ui, me } = useApp();
  const t = (en: string, hu: string) => tx(ui.lang, en, hu);
  const [ideas, setIdeas] = useState<Tile[] | null>(null);
  const [mine, setMine] = useState<Tile[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [demo, setDemo] = useState(false);

  useEffect(() => {
    track('pick_open');
    if (!me.user) {
      setIdeas([]);
    } else {
      uploads.list('idea', 30).then(
        (u) => setIdeas(u.map((x) => ({ key: `i${x.id}`, src: x.src, thumb: x.src, label: x.note || undefined, from: 'idea' as const }))),
        () => setIdeas([])
      );
    }
    // designs uploaded or already tried on, newest first, each once
    Promise.all([
      me.user ? uploads.list('design', 30).catch(() => []) : Promise.resolve([]),
      me.user ? cloud.all(0, 30).catch(() => []) : Promise.resolve([]),
      local.all().catch(() => []),
    ]).then(([ups, c, l]) => {
      const seen = new Set<string>();
      const out: (Tile & { at: string })[] = [];
      for (const p of [...l, ...c]) {
        if (!p.design || p.mode === 'existing' || p.mode === 'removal' || seen.has(p.design)) continue;
        seen.add(p.design);
        out.push({ key: `p${p.id}`, src: p.design, thumb: p.design, colorMode: p.colorMode, from: 'preview', at: p.created_at });
      }
      for (const u of ups) {
        if (seen.has(u.src)) continue;
        seen.add(u.src);
        out.push({ key: `d${u.id}`, src: u.src, thumb: u.src, from: 'design', at: u.created_at });
      }
      setMine(out.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 24));
    });
  }, [me.user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const lib: Tile[] = ALL_DESIGNS.slice(0, 9).map((d) => ({ key: `l${d.id}`, src: d.src, thumb: d.thumb || d.src, libId: d.id, label: ui.lang === 'hu' ? d.hu : d.en, from: 'library' }));

  const pick = async (x: Tile) => {
    if (busy) return;
    haptic();
    setBusy(x.key);
    track('pick_design', { from: x.from });
    try {
      await onPick(x);
    } finally {
      setBusy(null);
    }
  };

  const grid = (list: Tile[] | null) =>
    list === null ? (
      <div className="pick-grid">
        {[0, 1, 2].map((i) => (
          <div key={i} className="pick-tile ph" />
        ))}
      </div>
    ) : (
      <div className="pick-grid">
        {list.map((x) => (
          <button key={x.key} className={`pick-tile ${busy === x.key ? 'busy' : ''}`} onClick={() => pick(x)} disabled={!!busy} aria-label={x.label || t('Try this design', 'Ezt a mintát próbálom')}>
            <img src={x.thumb} alt="" loading="lazy" />
            {x.label && <span className="pick-label">{x.label}</span>}
          </button>
        ))}
      </div>
    );

  return (
    <div className="pick">
      <p className="kicker">{t('New tattoo', 'Új tetoválás')}</p>
      <h1 style={{ margin: 0 }}>{ui.t('gallery.title')}</h1>
      <p className="sub">{t('Pick a saved design to try on, or add a new one.', 'Válassz egy mentett mintát a felpróbáláshoz, vagy adj hozzá újat.')}</p>

      <button className="pick-new" onClick={onNew} disabled={!!busy}>
        <span className="pick-new-ico" aria-hidden="true">{Icon.plus}</span>
        <span>
          <b>{t('Add a new design', 'Új minta hozzáadása')}</b>
          <small>{t('A screenshot, a saved picture, a sketch or a link', 'Képernyőfotó, mentett kép, saját rajz vagy link')}</small>
        </span>
      </button>
      {/* the people who age a tattoo they already have make the most previews: a big way in, one photo, no design */}
      <button className="pick-new alt" onClick={() => onMode('existing')} disabled={!!busy}>
        <span className="pick-new-ico" aria-hidden="true">⏳</span>
        <span>
          <b>{t('How will my tattoo age?', 'Hogyan öregszik a meglévő tetoválásom?')}</b>
          <small>{t('One photo of it, no design needed', 'Csak egy fotó róla, minta nem kell')}</small>
        </span>
      </button>
      <div className="row pick-modes">
        <button className="chipbtn" onClick={() => onMode('removal')} disabled={!!busy}>
          {t('Removal preview', 'Eltávolítás előnézete')}
        </button>
        <button className="chipbtn" onClick={() => { setDemo((v) => !v); track('example_open', { where: 'pick' }); }} aria-expanded={demo}>
          {t('See an example first', 'Előbb egy példát nézek')}
        </button>
      </div>
      {demo && (
        <div style={{ margin: '10px 0 4px' }}>
          <StageSlider t={t} where="pick" compact />
        </div>
      )}

      {(ideas === null || ideas.length > 0) && (
        <section>
          <h2 className="pick-h">💡 {t('Your ideas', 'Ötleteid')}</h2>
          {grid(ideas)}
        </section>
      )}
      {(mine === null || mine.length > 0) && (
        <section>
          <h2 className="pick-h">{t('Designs you tried', 'Kipróbált mintáid')}</h2>
          {grid(mine)}
        </section>
      )}
      <section>
        <h2 className="pick-h">{t('From the library', 'A könyvtárból')}</h2>
        {grid(lib)}
        <p style={{ textAlign: 'center', margin: '14px 0 0' }}>
          <Link className="chipbtn" href={`/app/explore${qOf(ui.lang)}`}>
            {t('All designs', 'Összes minta')} →
          </Link>
        </p>
      </section>
    </div>
  );
}
