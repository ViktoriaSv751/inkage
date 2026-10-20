'use client';

export const STAGE_LABELS = [
  { key: 'fresh', label: 'Fresh', short: 'Today' },
  { key: 'healed', label: '1 year', short: '1 yr' },
  { key: 'y10', label: '10 years', short: '10 yrs' },
  { key: 'y30', label: '30 years', short: '30 yrs' },
  { key: 'y50', label: '50 years', short: '50 yrs' },
] as const;
export type StageKey = (typeof STAGE_LABELS)[number]['key'];

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    // pictures from other origins must come with CORS, or the canvas can't read them back
    // (in the store apps the page itself is not on inkage.app, so its photos are "other origin" too)
    if (/supabase\.co\/|cloudfront\.net\/|^https:\/\/inkage\.app\//.test(src)) img.crossOrigin = 'anonymous';
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

/** Read a File, fix orientation, downscale to maxSide, return data URL + size. */
const isHeic = (f: File | Blob) => /heic|heif/i.test(f.type) || /\.(heic|heif)$/i.test((f as File).name || '');

/** iPhone photos (HEIC/HEIF) can't be decoded by Chrome, Firefox or Android: convert them to JPEG first. */
export async function decodable(file: File): Promise<File | Blob> {
  if (!isHeic(file)) return file;
  try {
    // Safari can decode HEIC itself
    await createImageBitmap(file);
    return file;
  } catch {}
  const heic2any = (await import('heic2any')).default as (o: { blob: Blob; toType: string; quality: number }) => Promise<Blob | Blob[]>;
  const out = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 });
  return Array.isArray(out) ? out[0] : out;
}

export async function prepareImage(input: File, maxSide = 1024, type = 'image/jpeg') {
  const file = (await decodable(input)) as File;
  const url = URL.createObjectURL(file);
  try {
    let src: CanvasImageSource & { width: number; height: number };
    try {
      src = await createImageBitmap(file, { imageOrientation: 'from-image' } as any);
    } catch {
      src = await loadImage(url);
    }
    const scale = Math.min(1, maxSide / Math.max(src.width, src.height));
    const w = Math.round(src.width * scale);
    const h = Math.round(src.height * scale);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d')!;
    if (type === 'image/jpeg') {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, w, h);
    }
    ctx.drawImage(src, 0, 0, w, h);
    return { dataUrl: c.toDataURL(type, 0.88), w, h };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function shareOrDownload(blob: Blob, filename: string) {
  // Inside a claude.ai artifact, saving goes through the viewer's downloads capability.
  const claude = (window as any).claude;
  if (claude?.use) {
    const downloads = await claude.use('downloads').catch(() => null);
    if (downloads) {
      try {
        await downloads.save({ filename, data: blob });
      } catch (e: any) {
        if (e?.code !== 'declined' && e?.code !== 'rate_limited') console.warn('save failed', e);
      }
      return;
    }
  }
  // store apps: native share sheet (web views cannot download blobs)
  if ((window as any).Capacitor?.isNativePlatform?.()) {
    const { nativeShareFile } = await import('./native');
    if (await nativeShareFile(blob, filename).catch(() => false)) return;
  }
  const file = new File([blob], filename, { type: blob.type });
  const nav: any = navigator;
  if (nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: 'My tattoo in 50 years' });
      return;
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

export async function dataUrlToBlob(d: string) {
  return (await fetch(d)).blob();
}
