'use client';
import { useEffect, useRef, useState } from 'react';
import { useApp } from '../../AppProvider';
import { Icon } from '../../ui';
import { haptic } from '@/lib/store';
import { useScrollLock } from '@/lib/scrolllock';
import { L } from './utils';

export function CameraSheet({ placement, onClose, onShot, onFallback }: { placement: string; onClose: () => void; onShot: (b: Blob) => void; onFallback: () => void }) {
  const { ui } = useApp();
  const t = L(ui.lang);
  const vid = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  useScrollLock(true);

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        stream.current?.getTracks().forEach((x) => x.stop());
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1920 } }, audio: false });
        if (dead) return s.getTracks().forEach((x) => x.stop());
        stream.current = s;
        if (vid.current) {
          vid.current.srcObject = s;
          await vid.current.play().catch(() => {});
        }
      } catch {
        onFallback();
      }
    })();
    return () => {
      dead = true;
      // always release the camera, otherwise phones refuse it after a few uses
      stream.current?.getTracks().forEach((x) => x.stop());
      stream.current = null;
      if (vid.current) vid.current.srcObject = null;
    };
  }, [facing]); // eslint-disable-line react-hooks/exhaustive-deps

  // live advice while framing: too dark, too bright, hold still
  const [advice, setAdvice] = useState('');
  useEffect(() => {
    const c = document.createElement('canvas');
    c.width = 32;
    c.height = 32;
    const ctx = c.getContext('2d', { willReadFrequently: true } as any) as CanvasRenderingContext2D;
    let prev: Uint8ClampedArray | null = null;
    const i = setInterval(() => {
      const v = vid.current;
      if (!v || !v.videoWidth) return;
      ctx.drawImage(v, 0, 0, 32, 32);
      const d = ctx.getImageData(0, 0, 32, 32).data;
      let lum = 0, move = 0;
      for (let k = 0; k < d.length; k += 4) {
        const l = 0.299 * d[k] + 0.587 * d[k + 1] + 0.114 * d[k + 2];
        lum += l;
        if (prev) move += Math.abs(l - (0.299 * prev[k] + 0.587 * prev[k + 1] + 0.114 * prev[k + 2]));
      }
      lum /= 1024;
      move /= 1024;
      prev = d.slice();
      setAdvice(
        lum < 55 ? t('Too dark — move closer to a window', 'Túl sötét – menj közelebb az ablakhoz') : lum > 225 ? t('Too bright — avoid direct light', 'Túl világos – kerüld a közvetlen fényt') : move > 18 ? t('Hold still', 'Tartsd stabilan') : ''
      );
    }, 600);
    return () => clearInterval(i);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const shoot = () => {
    const v = vid.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext('2d')!.drawImage(v, 0, 0);
    haptic('success');
    c.toBlob((b) => b && onShot(b), 'image/jpeg', 0.92);
  };

  const limb = /back|hát|rib|borda/i.test(placement)
    ? 'M30 10h40l6 80H24z'
    : /hand|kéz|finger|ujj|wrist|csukló/i.test(placement)
      ? 'M38 95V55l-8-30c-1-5 6-7 8-2l6 20V12c0-5 7-5 7 0v28l2-32c0-5 7-5 7 0v34l3-26c1-5 7-4 7 1l-2 40 6-12c3-4 9-1 7 3l-12 30v17z'
      : 'M36 2c-4 30-6 60-4 96h36c2-36 0-66-4-96z';

  return (
    <div className="camera" role="dialog" aria-modal="true" aria-label={ui.t('create.photo.camera')}>
      <video ref={vid} playsInline muted />
      <div className="outline" aria-hidden="true">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none">
          <path d={limb} vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <p className={`cam-hint ${advice ? 'warn' : ''}`} role="status">{advice || t('Fit the area inside the outline, in daylight', 'Igazítsd a testrészt a körvonalba, nappali fényben')}</p>
      <button className="iconbtn dark cam-x" aria-label={ui.t('common.close')} onClick={onClose}>
        {Icon.close}
      </button>
      <div className="cam-bar">
        <span style={{ width: 44 }} />
        <button className="shutter" aria-label={t('Take photo', 'Fotó')} onClick={shoot} />
        <button className="iconbtn dark" aria-label={t('Switch camera', 'Kameraváltás')} onClick={() => setFacing(facing === 'user' ? 'environment' : 'user')}>
          {Icon.rotate}
        </button>
      </div>
    </div>
  );
}
