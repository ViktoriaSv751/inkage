'use client';

import { useEffect, useState } from 'react';
import { useApp } from '../AppProvider';
import { tx } from '@/lib/i18n';
import { CARE } from '@/lib/aftercare';
import { blobToDataUrl, cloud, local, lsGet, lsSet, Preview, shrink, StageKey } from '@/lib/store';

const DAY = 864e5;

/** After "I got it done": a healing checklist for the first four weeks. */
export function HealDiary({ preview }: { preview: Preview }) {
  const { ui } = useApp();
  const t = (en: string, hu: string) => tx(ui.lang, en, hu);
  const key = `ink_heal_${preview.id}`;
  const [done, setDone] = useState<number[]>([]);
  const [all, setAll] = useState(false);
  useEffect(() => setDone(lsGet<number[]>(key, [])), [key]);
  if (!preview.doneAt) return null;
  const day = Math.max(0, Math.floor((Date.now() - new Date(preview.doneAt).getTime()) / DAY));
  if (day > 60) return null;
  const toggle = (d: number) => {
    const next = done.includes(d) ? done.filter((x) => x !== d) : [...done, d];
    setDone(next);
    lsSet(key, next);
  };
  const pct = Math.round((done.length / CARE.length) * 100);
  return (
    <div className="card heal" style={{ marginTop: 12 }}>
      <div className="heal-head">
        <div>
          <h3 style={{ margin: 0 }}>{t('Healing diary', 'Gyógyulási napló')}</h3>
          <p className="muted small" style={{ margin: '2px 0 0' }}>{day <= 28 ? t(`Day ${day} of 28`, `${day}. nap a 28-ból`) : t('Healing period done', 'A gyógyulási idő letelt')}</p>
        </div>
        <span className="heal-pct" style={{ ['--v' as any]: pct }}>{pct}%</span>
      </div>
      <ol className="heal-list">
        {CARE.filter((s) => all || (s.day <= day + 7 && !(done.includes(s.day) && s.day < day))).map((s) => {
          const now = day >= s.day && (CARE.find((x) => x.day > s.day)?.day ?? 99) > day;
          return (
            <li key={s.day} className={`${done.includes(s.day) ? 'on' : ''} ${now ? 'now' : ''} ${day < s.day ? 'later' : ''}`}>
              <label>
                <input type="checkbox" checked={done.includes(s.day)} onChange={() => toggle(s.day)} />
                <span>
                  <b>{t(`Day ${s.day}`, `${s.day}. nap`)}{now ? ` · ${t('today', 'ma')}` : ''}</b>
                  {t(s.en, s.hu)}
                </span>
              </label>
            </li>
          );
        })}
      </ol>
      <button className="linkbtn" onClick={() => setAll(!all)}>
        {all ? t('Show only the next steps', 'Csak a következő lépések') : t('Show the whole 28 days', 'A teljes 28 nap mutatása')}
      </button>
      <p className="fine">{t('General aftercare information, not medical advice. Follow your artist’s instructions.', 'Általános ápolási tájékoztató, nem orvosi tanács. Kövesd a tetoválód utasításait.')}</p>
    </div>
  );
}

const YEARS: [StageKey, number][] = [['fresh', 0], ['healed', 1], ['y10', 10], ['y30', 30], ['y50', 50]];

/** Real photos of the tattoo over the years, next to the matching preview stage. */
export function RealVsPreview({ preview, onChange }: { preview: Preview; onChange: (p: Preview) => void }) {
  const { ui, me, toast } = useApp();
  const t = (en: string, hu: string) => tx(ui.lang, en, hu);
  const [busy, setBusy] = useState(false);
  if (!preview.doneAt) return null;
  const add = async (file: File) => {
    setBusy(true);
    try {
      const url = URL.createObjectURL(await import('@/lib/client').then((m) => m.decodable(file)));
      const src = await blobToDataUrl(await shrink(url, 1080, 0.86));
      URL.revokeObjectURL(url);
      const at = Date.now();
      const item = { at: new Date(at).toISOString(), src, key: `real_${at}` };
      const next = { ...preview, real: [...(preview.real || []), item] };
      if (preview.source === 'cloud' && me.user) await cloud.addImages(me.user.id, preview.id, { [item.key]: src });
      else await local.put(next);
      onChange(next);
      toast(t('Added — compare it with the preview below', 'Hozzáadva – lent összevetheted az előnézettel'));
    } catch {
      toast(t('Could not add the photo. Try again.', 'Nem sikerült hozzáadni a fotót. Próbáld újra.'));
    }
    setBusy(false);
  };
  const years = (iso: string) => (new Date(iso).getTime() - new Date(preview.doneAt!).getTime()) / (365.25 * DAY);
  const nearest = (y: number) => {
    const have = YEARS.filter(([k]) => preview.images[k]);
    return have.reduce((b, c) => (Math.abs(c[1] - y) < Math.abs(b[1] - y) ? c : b), have[0]);
  };
  return (
    <div className="card" style={{ marginTop: 12 }}>
      <h3 style={{ margin: 0 }}>{t('Reality vs. preview', 'Valóság vs. előnézet')}</h3>
      <p className="muted small" style={{ margin: '4px 0 12px' }}>
        {t('Add a photo of your real tattoo now and then (once a year is plenty). We put it next to the closest preview stage.', 'Időnként tölts fel egy fotót a valódi tetoválásodról (évente egy bőven elég). Mellé tesszük a legközelebbi előnézeti stádiumot.')}
      </p>
      {(preview.real || []).map((r) => {
        const y = years(r.at);
        const n = nearest(y);
        return (
          <div key={r.at} className="rvp">
            <figure>
              <img src={r.src} alt="" loading="lazy" />
              <figcaption>
                {t('Real', 'Valódi')} · {new Date(r.at).toLocaleDateString(ui.lang === 'hu' ? 'hu-HU' : 'en-GB')}
              </figcaption>
            </figure>
            {n && preview.images[n[0]] && (
              <figure>
                <img src={preview.images[n[0]]} alt="" loading="lazy" />
                <figcaption>{t('Preview', 'Előnézet')} · {ui.t(`stage.${n[0]}` as any)}</figcaption>
              </figure>
            )}
          </div>
        );
      })}
      <label className="btn ghost wide" style={{ cursor: 'pointer', marginTop: 4 }}>
        {busy ? '…' : t('Add a photo of the real tattoo', 'Fotó a valódi tetoválásról')}
        <input type="file" accept="image/*,.heic,.heif" hidden onChange={(e) => e.target.files?.[0] && add(e.target.files[0])} />
      </label>
    </div>
  );
}
