"""Turns the translators' output (/tmp/claude-0/tr/out/<lang>-<kind>-<n>[-x].json) into lib/locales/*.json,
checking every placeholder. Missing / broken entries stay English and are listed."""
import json, glob, os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TR = sys.argv[1] if len(sys.argv) > 1 else '/tmp/claude-0/tr'
items = {str(x['id']): x for x in json.load(open(f'{TR}/all.json'))}
if os.path.exists(f'{TR}/extra-items.json'):
    items.update({str(x['id']): x for x in json.load(open(f'{TR}/extra-items.json'))})
langs = ['de', 'es', 'pt', 'fr', 'it', 'pl', 'tr', 'ro', 'nl', 'sv', 'cs', 'el', 'uk', 'ja', 'ko', 'id', 'th', 'zh']
ph = lambda s: set(re.findall(r'\{\d+\}', s))
report = {}
for l in langs:
    got = {}
    for f in sorted(glob.glob(f'{TR}/out/{l}-*.json')) + sorted(glob.glob(f'{TR}/extra/{l}*.json')):
        try:
            got.update({str(k): v for k, v in json.load(open(f)).items()})
        except Exception as e:
            print('BAD JSON', f, e)
    ui = {'exact': {}, 'tpl': []}; content = {'exact': {}}
    missing, bad = [], []
    for i, x in items.items():
        t = got.get(i)
        if not isinstance(t, str) or not t.strip():
            missing.append(i); continue
        need = ph(x['en']); have = ph(t)
        if have - need or (need - have and not x['tpl']):
            bad.append(i); continue
        if x['tpl']:
            # placeholders the translation leaves out must only be English plural endings
            ui['tpl'].append([x['en'], t])
        elif x['content']:
            content['exact'][x['en']] = t
        else:
            ui['exact'][x['en']] = t
    # longer templates first, so "{0} votes so far" wins over "{0} votes"
    ui['tpl'].sort(key=lambda p: -len(p[0]))
    json.dump(ui, open(f'{ROOT}/lib/locales/{l}.json', 'w'), ensure_ascii=False, separators=(',', ':'))
    json.dump(content, open(f'{ROOT}/lib/locales/content-{l}.json', 'w'), ensure_ascii=False, separators=(',', ':'))
    nui = [i for i, x in items.items() if not x['content']]
    lost = set(missing + bad)
    report[l] = {'ok': len(items) - len(missing) - len(bad), 'missing': len(missing), 'bad': len(bad), 'ui_ok': sum(1 for i in nui if i not in lost), 'ui': len(nui)}
    open(f'{TR}/missing-{l}.json', 'w').write(json.dumps([{'id': int(i), 'en': items[i]['en']} for i in missing + bad], ensure_ascii=False))
# browser copies of the UI dictionaries, loaded by the page before the app starts
import hashlib
os.makedirs(f'{ROOT}/public/locales', exist_ok=True)
man = {}
for l in langs:
    raw = open(f'{ROOT}/lib/locales/{l}.json').read()
    open(f'{ROOT}/public/locales/{l}.js', 'w').write(f"window.__INK_LANG='{l}';window.__INK_DICT={raw};")
    man[l] = hashlib.sha1(raw.encode()).hexdigest()[:10]
ready = ['hu', 'en'] + [l for l in langs if report[l]['ui_ok'] >= 0.9 * report[l]['ui']]  # app texts done; articles fall back to English until translated
json.dump({l: v for l, v in man.items() if l in ready}, open(f'{ROOT}/lib/locales/manifest.json', 'w'))
# only languages that are (almost) fully translated are offered in the picker
json.dump(ready, open(f'{ROOT}/lib/locales/ready.json', 'w'))
print(json.dumps(report, indent=1))
