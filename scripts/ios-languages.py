"""Writes the iOS permission texts (ios/App/App/<lang>.lproj/InfoPlist.strings) for every language, registers them in the
Xcode project, in CFBundleLocalizations, and writes the no-internet page's texts into cap-www/index.html.
Takes effect with the next store build.   python3 scripts/ios-languages.py <folder with out/<lang>.json>"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TR = sys.argv[1]
APPLE = {'zh': 'zh-Hant', 'zhs': 'zh-Hans', 'no': 'nb', 'sr': 'sr-Latn'}
langs = sorted(f[:-5] for f in os.listdir(f'{TR}/out') if f.endswith('.json'))
esc = lambda s: s.replace('\\', '\\\\').replace('"', '\\"')
pb_path = f'{ROOT}/ios/App/App.xcodeproj/project.pbxproj'
pb = open(pb_path).read()
refs, kids, regions = [], [], []
offline = {}
for n, l in enumerate(langs):
    d = json.load(open(f'{TR}/out/{l}.json'))
    a = APPLE.get(l, l)
    os.makedirs(f'{ROOT}/ios/App/App/{a}.lproj', exist_ok=True)
    lines = ['"CFBundleDisplayName" = "InkAge";'] + [f'"{k[4:]}" = "{esc(v)}";' for k, v in d.items() if k.startswith('ios:')]
    open(f'{ROOT}/ios/App/App/{a}.lproj/InfoPlist.strings', 'w').write('\n'.join(lines) + '\n')
    offline[l] = [d['off:m'], d['off:b']]
    if f'path = {a}.lproj/InfoPlist.strings' not in pb:
        uid = f'1A0C0FFEE0000000000{n + 100:05d}'
        name = f'"{a}"' if '-' in a else a
        refs.append(f'\t\t{uid} /* {a} */ = {{isa = PBXFileReference; lastKnownFileType = text.plist.strings; name = {name}; path = {a}.lproj/InfoPlist.strings; sourceTree = "<group>"; }};\n')
        kids.append(f'\t\t\t\t{uid} /* {a} */,\n')
        regions.append(f'\t\t\t\t{name},\n')
marker = '\t\t1A0C0FFEE000000000000007 /* hu */ = {isa'
pb = pb.replace(marker, ''.join(refs) + marker, 1)
kid = '\t\t\t\t1A0C0FFEE000000000000007 /* hu */,\n'
pb = pb.replace(kid, kid + ''.join(kids), 1)
pb = re.sub(r'(knownRegions = \(\n(?:.*\n)*?\t\t\t\thu,\n)', lambda m: m.group(1) + ''.join(regions), pb, count=1)
open(pb_path, 'w').write(pb)

pl_path = f'{ROOT}/ios/App/App/Info.plist'
pl = open(pl_path).read()
items = ['en', 'hu'] + [APPLE.get(l, l) for l in langs]
pl = re.sub(r'(<key>CFBundleLocalizations</key>\s*<array>).*?(</array>)', lambda m: m.group(1) + '\n' + ''.join(f'\t\t<string>{i}</string>\n' for i in items) + '\t' + m.group(2), pl, count=1, flags=re.S)
open(pl_path, 'w').write(pl)

html_path = f'{ROOT}/cap-www/index.html'
h = open(html_path).read()
script = "<script>var T=" + json.dumps({**offline, 'en': ['No internet connection. Connect and try again.', 'Try again']}, ensure_ascii=False, separators=(',', ':')) + ";var n=(navigator.language||'en').toLowerCase(),l=n.slice(0,2);if(l==='zh')l=/^zh[-_](tw|hk|mo|hant)/.test(n)?'zh':'zhs';if(l==='nb'||l==='nn')l='no';if(l==='tl')l='fil';if(l!=='hu'){var t=T[l]||T.en;document.documentElement.lang=l;document.getElementById('m').textContent=t[0];document.querySelector('button').textContent=t[1]}</script>"
h = re.sub(r'<script>.*?</script>', lambda m: script, h, count=1, flags=re.S)
open(html_path, 'w').write(h)
print(len(langs), 'languages,', len(refs), 'added to Xcode')
