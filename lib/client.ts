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
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

/** Read a File, fix orientation, downscale to maxSide, return data URL + size. */
export async function prepareImage(file: File, maxSide = 1024, type = 'image/jpeg') {
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

/** Turn a design on a light background into ink-on-transparent. */
function designToInk(img: HTMLImageElement) {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, c.width, c.height);
  const p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    const lum = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
    const a = Math.max(0, Math.min(1, (235 - lum) / 120)) * (p[i + 3] / 255);
    p[i + 3] = Math.round(a * 255);
  }
  ctx.putImageData(d, 0, 0);
  return c;
}

const DEMO_AGING: Record<StageKey, { blur: number; alpha: number; filter: string }> = {
  fresh: { blur: 0, alpha: 0.95, filter: 'none' },
  healed: { blur: 0.4, alpha: 0.88, filter: 'saturate(0.9)' },
  y10: { blur: 1.2, alpha: 0.78, filter: 'saturate(0.7) sepia(0.15)' },
  y30: { blur: 2.4, alpha: 0.62, filter: 'saturate(0.4) sepia(0.25) hue-rotate(160deg)' },
  y50: { blur: 3.6, alpha: 0.5, filter: 'saturate(0.25) sepia(0.3) hue-rotate(170deg)' },
};

/** Local simulation used in demo mode and for locked teasers. */
export async function demoComposite(photo: string, design: string, size: string) {
  const [bg, ds] = await Promise.all([loadImage(photo), loadImage(design)]);
  const ink = designToInk(ds);
  const frac = size === 'small' ? 0.22 : size === 'large' ? 0.48 : 0.34;
  const out: Record<string, string> = {};
  for (const s of STAGE_LABELS) {
    const c = document.createElement('canvas');
    c.width = bg.naturalWidth;
    c.height = bg.naturalHeight;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(bg, 0, 0);
    const w = c.width * frac;
    const h = (w * ink.height) / ink.width;
    const cfg = DEMO_AGING[s.key];
    ctx.save();
    ctx.globalAlpha = cfg.alpha;
    ctx.globalCompositeOperation = 'multiply';
    ctx.filter = `${cfg.filter === 'none' ? '' : cfg.filter} blur(${cfg.blur * (c.width / 1000)}px)`.trim() || 'none';
    ctx.drawImage(ink, (c.width - w) / 2, (c.height - h) / 2, w, h);
    ctx.restore();
    out[s.key] = c.toDataURL('image/jpeg', 0.9);
  }
  return out as Record<StageKey, string>;
}

/** Render a 9:16 time-lapse video of the stages. Returns a Blob. */
export async function makeTimelapse(
  frames: { label: string; src: string }[],
  opts: { watermark: string; onProgress?: (p: number) => void }
): Promise<{ blob: Blob; ext: string }> {
  const W = 720;
  const H = 1280;
  const imgs = await Promise.all(frames.map((f) => loadImage(f.src)));
  await Promise.all([document.fonts?.load('900 96px "Big Shoulders Display"'), document.fonts?.load('600 34px "Instrument Sans"')]).catch(() => {});
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;

  const types = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'];
  const mime = types.find((t) => (window as any).MediaRecorder?.isTypeSupported?.(t));
  if (!mime) throw new Error('Video recording is not supported in this browser. Try Chrome or Safari.');
  const stream = (c as any).captureStream(30) as MediaStream;
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 5_000_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);

  const HOLD = 1300;
  const FADE = 700;
  const INTRO = 900;
  const per = HOLD + FADE;
  const total = INTRO + per * (imgs.length - 1) + HOLD + 600;

  const drawImg = (img: HTMLImageElement, alpha: number) => {
    // blurred cover background + contained foreground
    const coverS = Math.max(W / img.naturalWidth, H / img.naturalHeight);
    const fitS = Math.min(W / img.naturalWidth, (H * 0.78) / img.naturalHeight);
    ctx.globalAlpha = alpha;
    ctx.filter = 'blur(30px) brightness(0.45)';
    ctx.drawImage(img, (W - img.naturalWidth * coverS) / 2, (H - img.naturalHeight * coverS) / 2, img.naturalWidth * coverS, img.naturalHeight * coverS);
    ctx.filter = 'none';
    const fw = img.naturalWidth * fitS;
    const fh = img.naturalHeight * fitS;
    ctx.drawImage(img, (W - fw) / 2, (H - fh) / 2 + 30, fw, fh);
    ctx.globalAlpha = 1;
  };

  const drawFrame = (t: number) => {
    ctx.fillStyle = '#15122b';
    ctx.fillRect(0, 0, W, H);
    const tt = Math.max(0, t - INTRO);
    const idx = Math.min(imgs.length - 1, Math.floor(tt / per));
    const local = tt - idx * per;
    const fading = idx < imgs.length - 1 && local > HOLD;
    const f = fading ? (local - HOLD) / FADE : 0;
    drawImg(imgs[idx], 1);
    if (fading) drawImg(imgs[idx + 1], f);

    // label
    const label = fading && f > 0.5 ? frames[idx + 1].label : frames[idx].label;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = '900 96px "Big Shoulders Display", Impact, sans-serif';
    ctx.shadowColor = 'rgba(0,0,0,.6)';
    ctx.shadowBlur = 18;
    ctx.fillText(label.toUpperCase(), W / 2, 150);
    ctx.shadowBlur = 0;
    // progress bar
    const prog = Math.min(1, t / (total - 600));
    ctx.fillStyle = 'rgba(255,255,255,.18)';
    ctx.fillRect(80, 190, W - 160, 6);
    ctx.fillStyle = '#8b73ff';
    ctx.fillRect(80, 190, (W - 160) * prog, 6);
    // intro text
    if (t < INTRO + 200) {
      ctx.globalAlpha = Math.max(0, 1 - Math.max(0, t - INTRO + 200) / 400);
      ctx.font = '600 34px "Instrument Sans", system-ui, sans-serif';
      ctx.fillText('my tattoo in 50 years 👀', W / 2, H - 140);
      ctx.globalAlpha = 1;
    }
    ctx.font = '600 26px "Instrument Sans", system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    ctx.fillText(opts.watermark, W / 2, H - 60);
  };

  return new Promise((resolve, reject) => {
    rec.onstop = () => {
      const blob = new Blob(chunks, { type: mime.split(';')[0] });
      resolve({ blob, ext: mime.includes('mp4') ? 'mp4' : 'webm' });
    };
    rec.onerror = (e: any) => reject(e.error || e);
    drawFrame(0);
    rec.start(250);
    const start = performance.now();
    const tick = () => {
      const t = performance.now() - start;
      drawFrame(t);
      opts.onProgress?.(Math.min(1, t / total));
      if (t < total) requestAnimationFrame(tick);
      else setTimeout(() => rec.stop(), 100);
    };
    requestAnimationFrame(tick);
  });
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
