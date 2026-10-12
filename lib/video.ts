'use client';
import { loadImage } from './client';

export type Template = 'timelapse' | 'wipe' | 'poll';
export const HOOKS = {
  en: [
    'my tattoo in 50 years 👀',
    'I asked AI how my tattoo will age…',
    'glad I checked this before getting it',
    'fine line tattoos after 50 years 😳',
  ],
  hu: [
    'a tetoválásom 50 év múlva 👀',
    'megkérdeztem az AI-t, hogy öregszik a tetoválásom…',
    'jó, hogy ezt megnéztem előtte',
    'fine line tetoválás 50 év után 😳',
  ],
};

type Frame = { label: string; src: string };

const W = 720;
const H = 1280;

function pickMime() {
  const types = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'];
  const mime = types.find((t) => (window as any).MediaRecorder?.isTypeSupported?.(t));
  if (!mime) throw new Error('Video recording is not supported in this browser. Try Chrome or Safari.');
  return mime;
}

function cover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, alpha = 1, clip?: [number, number]) {
  const coverS = Math.max(W / img.naturalWidth, H / img.naturalHeight);
  const fitS = Math.min(W / img.naturalWidth, (H * 0.74) / img.naturalHeight);
  ctx.save();
  if (clip) {
    ctx.beginPath();
    ctx.rect(clip[0], 0, clip[1] - clip[0], H);
    ctx.clip();
  }
  ctx.globalAlpha = alpha;
  ctx.filter = 'blur(30px) brightness(0.42)';
  ctx.drawImage(img, (W - img.naturalWidth * coverS) / 2, (H - img.naturalHeight * coverS) / 2, img.naturalWidth * coverS, img.naturalHeight * coverS);
  ctx.filter = 'none';
  const fw = img.naturalWidth * fitS;
  const fh = img.naturalHeight * fitS;
  ctx.drawImage(img, (W - fw) / 2, (H - fh) / 2 + 40, fw, fh);
  ctx.restore();
}

function text(ctx: CanvasRenderingContext2D, s: string, y: number, font: string, color = '#fff', alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = 'center';
  ctx.fillStyle = color;
  ctx.font = font;
  ctx.shadowColor = 'rgba(0,0,0,.6)';
  ctx.shadowBlur = 18;
  // wrap
  const words = s.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (ctx.measureText(t).width > W - 100 && line) {
      lines.push(line);
      line = w;
    } else line = t;
  }
  lines.push(line);
  lines.forEach((l, i) => ctx.fillText(l, W / 2, y + i * parseInt(font.match(/(\d+)px/)?.[1] || '40') * 1.15));
  ctx.restore();
}

export async function makeVideo(
  frames: Frame[],
  opts: { template: Template; hook: string; watermark: string; yes?: string; no?: string; onProgress?: (p: number) => void }
): Promise<{ blob: Blob; ext: string }> {
  const imgs = await Promise.all(frames.map((f) => loadImage(f.src)));
  await Promise.all([document.fonts?.load('900 96px "Big Shoulders Display"'), document.fonts?.load('600 34px "Instrument Sans"')]).catch(() => {});
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  const mime = pickMime();
  const stream = (c as any).captureStream(30) as MediaStream;
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 5_000_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);

  const display = '900 96px "Big Shoulders Display", Impact, sans-serif';
  const body = '600 36px "Instrument Sans", system-ui, sans-serif';
  const last = imgs.length - 1;
  let total = 0;
  let draw: (t: number) => void;

  if (opts.template === 'timelapse') {
    const HOLD = 1200, FADE = 700, INTRO = 1300, per = HOLD + FADE;
    total = INTRO + per * last + HOLD + 700;
    draw = (t) => {
      const tt = Math.max(0, t - INTRO);
      const idx = Math.min(last, Math.floor(tt / per));
      const local = tt - idx * per;
      const fading = idx < last && local > HOLD;
      const f = fading ? (local - HOLD) / FADE : 0;
      cover(ctx, imgs[idx]);
      if (fading) cover(ctx, imgs[idx + 1], f);
      const label = fading && f > 0.5 ? frames[idx + 1].label : frames[idx].label;
      text(ctx, label.toUpperCase(), 160, display);
      ctx.fillStyle = 'rgba(255,255,255,.18)';
      ctx.fillRect(80, 200, W - 160, 6);
      ctx.fillStyle = '#8b73ff';
      ctx.fillRect(80, 200, (W - 160) * Math.min(1, t / (total - 700)), 6);
      if (t < INTRO + 300) text(ctx, opts.hook, H - 190, body, '#fff', Math.max(0, 1 - Math.max(0, t - INTRO) / 300));
    };
  } else if (opts.template === 'wipe') {
    const a = imgs[0], b = imgs[last];
    total = 7200;
    draw = (t) => {
      const p = t < 1500 ? 0 : t < 5200 ? (Math.sin(((t - 1500) / 3700) * Math.PI * 2 - Math.PI / 2) + 1) / 2 : 1;
      const x = W * (1 - p);
      cover(ctx, a);
      cover(ctx, b, 1, [x, W]);
      ctx.fillStyle = '#fff';
      ctx.fillRect(x - 2, 0, 4, H);
      text(ctx, frames[0].label.toUpperCase(), 160, '900 64px "Big Shoulders Display", Impact', '#fff', p < 0.5 ? 1 : 0.35);
      text(ctx, frames[last].label.toUpperCase(), 240, '900 64px "Big Shoulders Display", Impact', '#fff', p >= 0.5 ? 1 : 0.35);
      text(ctx, opts.hook, H - 190, body);
    };
  } else {
    // poll: fresh, then 50 years, then question with two answer bubbles
    total = 8200;
    draw = (t) => {
      const f = Math.min(1, Math.max(0, (t - 2200) / 900));
      cover(ctx, imgs[0]);
      if (f > 0) cover(ctx, imgs[last], f);
      text(ctx, (f < 0.5 ? frames[0].label : frames[last].label).toUpperCase(), 160, display);
      if (t > 4300) {
        const k = Math.min(1, (t - 4300) / 400);
        ctx.save();
        ctx.globalAlpha = k;
        ctx.fillStyle = 'rgba(21,18,43,.78)';
        ctx.fillRect(0, H - 420, W, 420);
        ctx.restore();
        text(ctx, opts.hook, H - 340, '700 42px "Instrument Sans", system-ui', '#fff', k);
        const bw = 260, bh = 86, y = H - 200;
        [[W / 2 - bw - 20, opts.yes || 'YES', '#4b2bd6'], [W / 2 + 20, opts.no || 'NO', '#e0483b']].forEach(([x, s, col]) => {
          ctx.save();
          ctx.globalAlpha = k;
          ctx.fillStyle = col as string;
          ctx.beginPath();
          (ctx as any).roundRect(x as number, y, bw, bh, 43);
          ctx.fill();
          ctx.restore();
          text(ctx, s as string, y + 58, '800 40px "Instrument Sans", system-ui', '#fff', k);
        });
      }
    };
  }

  const drawAll = (t: number) => {
    ctx.fillStyle = '#15122b';
    ctx.fillRect(0, 0, W, H);
    draw(t);
    ctx.save();
    ctx.font = '600 26px "Instrument Sans", system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    ctx.textAlign = 'center';
    ctx.fillText(opts.watermark, W / 2, H - 50);
    ctx.restore();
  };

  return new Promise((resolve, reject) => {
    rec.onstop = () => resolve({ blob: new Blob(chunks, { type: mime.split(';')[0] }), ext: mime.includes('mp4') ? 'mp4' : 'webm' });
    rec.onerror = (e: any) => reject(e.error || e);
    drawAll(0);
    rec.start(250);
    const start = performance.now();
    const tick = () => {
      const t = performance.now() - start;
      drawAll(t);
      opts.onProgress?.(Math.min(1, t / total));
      if (t < total) requestAnimationFrame(tick);
      else setTimeout(() => rec.stop(), 120);
    };
    requestAnimationFrame(tick);
  });
}
