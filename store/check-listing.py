#!/usr/bin/env python3
"""Checks store/LISTING-ASO.md: character limits (Python len(), what both stores count),
App Store keyword format, words repeated between name/subtitle and keywords, and banned words.

Run: python3 store/check-listing.py   (exit code 1 if anything is over a limit or banned)
"""
import re
import sys
from pathlib import Path

SRC = Path(__file__).with_name('LISTING-ASO.md')
LIMITS = {
    'Name': 30,
    'Subtitle': 30,
    'Keywords': 100,
    'Promotional text': 170,
    'Title': 30,
    'Short description': 80,
    'Description': 4000,
}
# "free" in every listing language, competitor and social network names (App Review rejected these before)
BANNED = [
    r'\bfree\b', r'\bfreely\b', r'gratis', r'grátis', r'gratuit', r'kostenlos', r'kostenfrei', r'ingyen',
    r'darmow', r'bezpłat', r'zdarma', r'bezplat', r'無料', r'\bgratuita?\b', r'gratuito',
    r'inkhunter', r'flashes', r'inkverse', r'inkview', r'pinterest', r'instagram', r'tiktok', r'reels',
    r'youtube', r'\bAR\b', r'augmented', r'erweiterte realität',
]
FIELD = re.compile(r'^\*\*(Name|Subtitle|Keywords|Promotional text|Title|Short description):\*\* (.*)$', re.M)


def sections(text):
    for part in re.split(r'^## ', text, flags=re.M)[1:]:
        head, _, body = part.partition('\n')
        m = re.search(r'\(([a-zA-Z-]+)[,)]', head)
        if not m:
            continue
        yield m.group(1), body


def main():
    text = SRC.read_text(encoding='utf-8')
    rows, problems = [], []
    for code, body in sections(text):
        f = {k: v.strip() for k, v in FIELD.findall(body)}
        d = body.split('### Description', 1)
        desc = d[1].split('\n', 1)[1].strip() if len(d) > 1 else ''
        f['Description'] = desc
        for k, lim in LIMITS.items():
            if k not in f or not f[k]:
                problems.append(f'{code}: {k} missing')
            elif len(f[k]) > lim:
                problems.append(f'{code}: {k} {len(f[k])} > {lim}')
        for k in ('Name', 'Title'):
            if not f.get(k, '').startswith('InkAge'):
                problems.append(f'{code}: {k} does not start with InkAge')
        kw = f.get('Keywords', '')
        if ' ,' in kw or ', ' in kw or kw.startswith(' ') or kw.endswith(','):
            problems.append(f'{code}: keywords must be comma-separated without spaces around commas')
        words = [w for w in kw.split(',') if w]
        if len(set(w.lower() for w in words)) != len(words):
            problems.append(f'{code}: duplicate keyword')
        seen = set(re.findall(r'\w+', (f.get('Name', '') + ' ' + f.get('Subtitle', '')).lower()))
        dup = [w for w in words if w.lower() in seen]
        if dup:
            problems.append(f'{code}: keywords repeat name/subtitle words (wasted): {dup}')
        for field, val in f.items():
            for b in BANNED:
                if re.search(b, val, flags=re.I):
                    problems.append(f'{code}: banned "{b}" in {field}')
        rows.append((code, [len(f.get(k, '')) for k in LIMITS]))

    hdr = ['Lang'] + [f'{k} ({v})' for k, v in LIMITS.items()]
    print('| ' + ' | '.join(hdr) + ' |')
    print('|' + '---|' * len(hdr))
    for code, n in rows:
        print('| ' + ' | '.join([code] + [str(x) for x in n]) + ' |')
    print()
    print(f'{len(rows)} languages checked.')
    if problems:
        print('PROBLEMS:')
        for p in problems:
            print(' -', p)
        sys.exit(1)
    print('All limits respected, no banned words.')


if __name__ == '__main__':
    main()
