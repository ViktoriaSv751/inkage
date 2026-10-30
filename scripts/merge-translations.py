"""Adds new translations to lib/locales/*.json without rebuilding them from scratch (build-locales.py needs the
translators' whole original output). Input: a folder with items.json ([{id, en, tpl, content}]) and out/<lang>.json
({id: translation}). Every placeholder is checked; broken or missing entries stay English and are listed.
Then the browser copies (public/locales/<lang>.js) and their version hashes (lib/locales/manifest.json) are rewritten.

    python3 scripts/merge-translations.py <folder>
"""
import hashlib, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TR = sys.argv[1]
items = {str(x['id']): x for x in json.load(open(f'{TR}/items.json'))}
ph = lambda s: set(re.findall(r'\{\d+\}', s))
langs = sorted(f[:-5] for f in os.listdir(f'{TR}/out') if f.endswith('.json'))
report = {}
for l in langs:
    got = {str(k): v for k, v in json.load(open(f'{TR}/out/{l}.json')).items()}
    ui = json.load(open(f'{ROOT}/lib/locales/{l}.json'))
    content = json.load(open(f'{ROOT}/lib/locales/content-{l}.json'))
    tpl = {p[0]: p[1] for p in ui['tpl']}
    bad = []
    for i, x in items.items():
        t = got.get(i)
        if not isinstance(t, str) or not t.strip():
            bad.append(i)
            continue
        need, have = ph(x['en']), ph(t)
        if have - need or (need - have and not x['tpl']):
            bad.append(i)
            continue
        if x['tpl']:
            tpl[x['en']] = t
        elif x['content']:
            content['exact'][x['en']] = t
        else:
            ui['exact'][x['en']] = t
    # longer templates first, so "{0} votes so far" wins over "{0} votes"
    ui['tpl'] = sorted(([k, v] for k, v in tpl.items()), key=lambda p: -len(p[0]))
    json.dump(ui, open(f'{ROOT}/lib/locales/{l}.json', 'w'), ensure_ascii=False, separators=(',', ':'))
    json.dump(content, open(f'{ROOT}/lib/locales/content-{l}.json', 'w'), ensure_ascii=False, separators=(',', ':'))
    report[l] = {'added': len(items) - len(bad), 'bad': [items[i]['en'][:60] for i in bad]}

man = json.load(open(f'{ROOT}/lib/locales/manifest.json'))
for l in langs:
    raw = open(f'{ROOT}/lib/locales/{l}.json').read()
    open(f'{ROOT}/public/locales/{l}.js', 'w').write(f"window.__INK_LANG='{l}';window.__INK_DICT={raw};")
    if l in man:
        man[l] = hashlib.sha1(raw.encode()).hexdigest()[:10]
json.dump(man, open(f'{ROOT}/lib/locales/manifest.json', 'w'))
print(json.dumps(report, ensure_ascii=False, indent=1))
