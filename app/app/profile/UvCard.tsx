'use client';

import { useState } from 'react';
import { useApp } from '../AppProvider';
import { tx } from '@/lib/i18n';
import { track } from '@/lib/store';

/** Today's UV index where you are, and what it means for a tattoo. */
export function UvCard() {
  const { ui } = useApp();
  const t = (en: string, hu: string) => tx(ui.lang, en, hu);
  const [st, setSt] = useState<'idle' | 'busy' | 'err' | 'denied'>('idle');
  const [uv, setUv] = useState<{ today: number; tomorrow: number } | null>(null);
  const check = () => {
    if (!navigator.geolocation) return setSt('err');
    setSt('busy');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          // rounded to ~10 km: enough for UV, nothing more precise leaves the phone
          const lat = pos.coords.latitude.toFixed(1);
          const lon = pos.coords.longitude.toFixed(1);
          const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=uv_index_max&timezone=auto&forecast_days=2`);
          const d = await r.json();
          const v = d?.daily?.uv_index_max;
          if (!Array.isArray(v)) throw new Error();
          setUv({ today: Math.round(v[0]), tomorrow: Math.round(v[1]) });
          setSt('idle');
          track('uv_check');
        } catch {
          setSt('err');
        }
      },
      () => setSt('denied'),
      { maximumAge: 3600e3, timeout: 10000 }
    );
  };
  const advice = (n: number) =>
    n <= 2
      ? t('Low. A healed tattoo is fine; new ink still stays covered.', 'Alacsony. Gyógyult tetoválásnak rendben; a friss maradjon takarva.')
      : n <= 5
        ? t('Moderate. SPF 30+ on visible tattoos, reapply after 2 hours.', 'Közepes. 30+ fényvédő a látható tetoválásra, 2 óránként újra.')
        : n <= 7
          ? t('High. SPF 50 on tattoos, shade around midday.', 'Magas. 50-es fényvédő a tetoválásra, délben árnyék.')
          : t('Very high. Cover tattoos or SPF 50 every 2 hours; avoid midday sun.', 'Nagyon magas. Takard le, vagy 2 óránként 50-es fényvédő; kerüld a déli napot.');
  const color = (n: number) => (n <= 2 ? 'var(--green)' : n <= 5 ? 'var(--amber)' : n <= 7 ? '#e5762d' : 'var(--red)');
  return (
    <div className="card" style={{ marginTop: 12 }}>
      <h2>{t('Sun today', 'Mai napsütés')}</h2>
      <p className="muted small">{t('UV is the main reason tattoos fade. Check today’s UV index where you are.', 'Az UV a fakulás fő oka. Nézd meg a mai UV-indexet ott, ahol vagy.')}</p>
      {uv ? (
        <div className="uv-row">
          {(
            [
              [t('Today', 'Ma'), uv.today],
              [t('Tomorrow', 'Holnap'), uv.tomorrow],
            ] as const
          ).map(([l, n]) => (
            <div key={l} className="uv-box" style={{ ['--c' as any]: color(n) }}>
              <b>{n}</b>
              <span>{l}</span>
            </div>
          ))}
          <p className="uv-adv">{advice(Math.max(uv.today, 0))}</p>
        </div>
      ) : (
        <button className="btn ghost wide" onClick={check} disabled={st === 'busy'}>
          {st === 'busy' ? '…' : t('Show the UV index here', 'UV-index itt, ahol vagyok')}
        </button>
      )}
      {st === 'denied' && <p className="small muted">{t('Location is off. Allow it for this site to see your UV index.', 'A helymeghatározás ki van kapcsolva. Engedélyezd ennél az oldalnál a UV-indexhez.')}</p>}
      {st === 'err' && <p className="small muted">{t('Could not load the UV index. Try again later.', 'Nem sikerült betölteni a UV-indexet. Próbáld később.')}</p>}
      <p className="fine">{t('Your approximate location (about 10 km) is sent to Open-Meteo for the forecast; we don’t store it.', 'A közelítő helyed (kb. 10 km) az Open-Meteo időjárás-szolgáltatáshoz megy az előrejelzéshez; mi nem tároljuk.')}</p>
    </div>
  );
}
