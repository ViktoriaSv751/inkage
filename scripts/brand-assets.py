"""Builds every logo/icon/splash file from the brand mark (store/brand/mark-black.png, transparent background)."""
from PIL import Image
import os
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
mark = Image.open(os.path.join(R, 'store/brand/mark-black.png')).convert('RGBA')
mark = mark.crop(mark.getbbox())
A = mark.split()[3]

def logo(color, w):
    h = round(w * mark.height / mark.width)
    a = A.resize((w, h), Image.LANCZOS)
    im = Image.new('RGBA', (w, h), color + (0,))
    im.putalpha(a)
    return im

def canvas(size, bg, fg, frac, mode='RGB'):
    c = Image.new('RGBA', (size, size), bg + ((255,) if bg is not None else ()) if bg else (0, 0, 0, 0))
    w = round(size * frac)
    l = logo(fg, w)
    # optical centre: the ink drops make the mark look left-heavy, nudge it a little right
    c.alpha_composite(l, ((size - l.width) // 2 + round(size * 0.012), (size - l.height) // 2))
    return c.convert(mode) if mode == 'RGB' else c

W, B = (255, 255, 255), (0, 0, 0)
out = lambda p: os.path.join(R, p)
# app icon (store + native): black ink bottle on white
canvas(1024, W, B, 0.70).save(out('resources/icon.png'))
canvas(1024, W, B, 0.70).save(out('store/appstore-icon-1024.png'))
canvas(512, W, B, 0.70).save(out('store/play-icon-512.png'))
canvas(1024, B, W, 0.70).save(out('resources/icon-dark.png'))
# Android adaptive icon: foreground inside the 66% safe zone
canvas(1024, None, B, 0.52, 'RGBA').save(out('resources/icon-foreground.png'))
Image.new('RGB', (1024, 1024), W).save(out('resources/icon-background.png'))
# splash screens (light / dark)
canvas(2732, W, B, 0.22).save(out('resources/splash.png'))
canvas(2732, (0, 0, 0), W, 0.22).save(out('resources/splash-dark.png'))
# web / PWA
canvas(180, W, B, 0.74).save(out('public/icons/apple-touch-icon.png'))
canvas(192, W, B, 0.74).save(out('public/icons/icon-192.png'))
canvas(512, W, B, 0.74).save(out('public/icons/icon-512.png'))
canvas(512, W, B, 0.56).save(out('public/icons/maskable-512.png'))
logo(B, 600).save(out('store/brand/mark-black-600.png'))
logo(W, 600).save(out('store/brand/mark-white-600.png'))
print('ok')
