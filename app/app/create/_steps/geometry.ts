import type { Placement } from '@/lib/editor';
import type { Area, Design, Photo } from './types';

/** Place and size the design so it sits inside the detected body area, aligned with the limb. */
export function fitToArea(area: Area, design: Design, photo: Photo): Placement {
  const [t, l, b, r] = area.box;
  const bw = r - l, bh = b - t;
  const aspect = photo.w / photo.h;
  const tilt = Math.abs(area.angle) > 12 ? area.angle : 0;
  // a tilted limb looks wider in its bounding box than it really is
  const k = tilt ? Math.cos((Math.abs(tilt) * Math.PI) / 180) * 0.8 : 1;
  const w = Math.max(0.06, Math.min(bw * 0.72 * k, (bh * 0.72) / (design.ratio * aspect), 0.7));
  return { x: (l + r) / 2, y: (t + b) / 2, w, rot: Math.round(tilt), mirror: false };
}

/** True when any corner of the placed design falls outside the detected area (with a little tolerance). */
export function overflows(area: Area, design: Design, photo: Photo, pl: Placement) {
  const [t, l, b, r] = area.box;
  const aspect = photo.w / photo.h;
  const hw = pl.w / 2, hh = (pl.w * design.ratio * aspect) / 2;
  const a = (pl.rot * Math.PI) / 180;
  const pad = 0.025;
  return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].some(([dx, dy]) => {
    // rotate in pixel space, then back to fractions
    const px = dx * photo.w, py = dy * photo.h;
    const x = pl.x + (px * Math.cos(a) - py * Math.sin(a)) / photo.w;
    const y = pl.y + (px * Math.sin(a) + py * Math.cos(a)) / photo.h;
    return x < l - pad || x > r + pad || y < t - pad || y > b + pad;
  });
}
