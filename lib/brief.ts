'use client';
import { loadImage } from './client';
import type { Preview } from './store';

/**
 * One-page A4 sheet for the tattoo artist: design, placement, size, the fresh and 50-year
 * previews, the longevity notes and the user's own notes. Drawn on a canvas (so Hungarian
 * accents render with the app's fonts) and wrapped into a PDF.
 */
export async function artistPdf(p: Preview, lang: 'en' | 'hu', placeLabel: string) {
  const L = (en: string, hu: string) => (lang === 'hu' ? hu : en);
  const W = 1240, H = 1754, M = 80;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  await Promise.all([document.fonts?.load('800 64px "Geist Sans"'), document.fonts?.load('600 28px "Geist Sans"')]).catch(() => {});
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);

  const text = (s: string, x: number, y: number, font: string, color = '#000000', maxW = W - 2 * M, lh = 1.35) => {
    ctx.font = font;
    ctx.fillStyle = color;
    const size = parseInt(font.match(/(\d+)px/)?.[1] || '28');
    const words = s.split(' ');
    let line = '';
    for (const w of words) {
      const t = line ? `${line} ${w}` : w;
      if (ctx.measureText(t).width > maxW && line) {
        ctx.fillText(line, x, y);
        y += size * lh;
        line = w;
      } else line = t;
    }
    if (line) ctx.fillText(line, x, y);
    return y + size * lh;
  };
  const img = async (src: string | undefined, x: number, y: number, w: number, h: number, contain = false) => {
    if (!src) return;
    try {
      const i = await loadImage(src);
      const s = contain ? Math.min(w / i.naturalWidth, h / i.naturalHeight) : Math.max(w / i.naturalWidth, h / i.naturalHeight);
      const dw = i.naturalWidth * s, dh = i.naturalHeight * s;
      ctx.save();
      ctx.beginPath();
      (ctx as any).roundRect(x, y, w, h, 24);
      ctx.clip();
      ctx.fillStyle = '#f4f1ee';
      ctx.fillRect(x, y, w, h);
      ctx.drawImage(i, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
      ctx.restore();
    } catch {}
  };

  // header
  text('INKAGE', M, 110, '800 44px "Geist Sans", system-ui', '#5b3df5');
  let y = text(L('Tattoo brief for my artist', 'Tetoválás-terv a tetoválómnak'), M, 190, '800 72px "Geist Sans", system-ui');
  y = text(new Date(p.created_at).toLocaleDateString(lang === 'hu' ? 'hu-HU' : 'en-GB'), M, y, '600 26px "Geist Sans", system-ui', '#5c5c62');

  // facts row
  const facts: [string, string][] = [
    [L('Placement', 'Testrész'), placeLabel],
    [L('Size', 'Méret'), p.sizeCm ? `≈ ${p.sizeCm.toFixed(1)} cm` : p.size || '–'],
    [L('Longevity score', 'Tartósság'), p.score !== null ? `${p.score}/100` : '–'],
  ];
  const fy = y + 20;
  facts.forEach(([k, v], i) => {
    const x = M + i * 360;
    ctx.fillStyle = '#f4f4f2';
    ctx.beginPath();
    (ctx as any).roundRect(x, fy, 340, 120, 20);
    ctx.fill();
    text(k.toUpperCase(), x + 24, fy + 42, '700 20px "Geist Sans", system-ui', '#5c5c62', 300);
    text(v, x + 24, fy + 92, '800 40px "Geist Sans", system-ui', '#000000', 300);
  });
  y = fy + 160;

  // images: design · fresh · 50 years
  const iw = (W - 2 * M - 40) / 3, ih = iw * 1.25;
  await img(p.design, M, y, iw, ih, true);
  await img(p.images.fresh, M + iw + 20, y, iw, ih);
  await img(p.images.y50 || p.images.y30, M + 2 * (iw + 20), y, iw, ih);
  [L('Design', 'Minta'), L('Fresh (preview)', 'Frissen (előnézet)'), L('In 50 years (preview)', '50 év múlva (előnézet)')].forEach((s, i) =>
    text(s, M + i * (iw + 20), y + ih + 40, '700 24px "Geist Sans", system-ui', '#000000', iw)
  );
  y += ih + 90;

  // suggestions + notes
  if (p.report?.suggestions?.length) {
    y = text(L('What would make it last longer', 'Mitől lesz tartósabb'), M, y, '800 40px "Geist Sans", system-ui');
    for (const s of p.report.suggestions.slice(0, 3)) y = text(`•  ${s}`, M, y + 4, '500 26px "Geist Sans", system-ui', '#000000');
    y += 16;
  }
  if (p.notes) {
    y = text(L('My notes', 'Jegyzeteim'), M, y, '800 40px "Geist Sans", system-ui');
    y = text(p.notes, M, y + 4, '500 26px "Geist Sans", system-ui', '#000000');
  }
  text(
    L('Previews are AI simulations made with InkAge (inkage.vercel.app). Your artist has the final say on size, needle and technique.', 'Az előnézetek az InkAge MI-szimulációi (inkage.vercel.app). A méretről, tűről és technikáról a tetoválód dönt.'),
    M,
    H - 90,
    '500 22px "Geist Sans", system-ui',
    '#5c5c62'
  );

  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
  pdf.addImage(c.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, 595.28, 841.89);
  return pdf.output('blob') as Blob;
}
