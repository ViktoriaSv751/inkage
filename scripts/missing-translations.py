"""Lists the English strings of the app and the website (not the Hungarian-only admin) that a language has no
translation for. Run `node scripts/extract-strings.mjs` first.   python3 scripts/missing-translations.py [lang]"""
import json, os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
s = json.load(open(f'{ROOT}/scripts/strings.json'))
admin = lambda files: all(f.startswith(('app/admin', 'lib/admin', 'app/api/admin')) for f in files)
langs = sys.argv[1:] or sorted(f[:-5] for f in os.listdir(f'{ROOT}/lib/locales') if f.endswith('.json') and '-' not in f and f[:-5] not in ('manifest', 'ready'))
for l in langs:
    ui = json.load(open(f'{ROOT}/lib/locales/{l}.json'))
    ct = json.load(open(f'{ROOT}/lib/locales/content-{l}.json'))
    have = set(ui['exact']) | set(ct['exact'])
    tpl = {p[0] for p in ui['tpl']}
    miss = [k for k, e in s['exact'].items() if k not in have and not admin(e['files'])]
    miss += [k for k, e in s['tpl'].items() if k not in tpl and not admin(e['files'])]
    print(l, len(miss), *(['  ' + m[:90] for m in miss[:20]] if len(sys.argv) > 1 else []), sep='\n' if len(sys.argv) > 1 else ' ')
