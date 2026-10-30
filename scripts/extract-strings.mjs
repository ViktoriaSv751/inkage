// Collects every English UI/content string (the `en` side of t/T/L/tx calls and of {en, hu} objects,
// plus server error messages) into scripts/strings.json, for translation into the other languages.
import ts from 'typescript';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const files = [];
const walk = (d) => {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (f === 'node_modules' || f === '.next' || f.startsWith('.')) continue;
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p);
    else if (/\.(tsx?|mjs)$/.test(f) && !/\.d\.ts$/.test(f) && !p.includes('/scripts/')) files.push(p);
  }
};
walk(path.join(ROOT, 'app'));
walk(path.join(ROOT, 'lib'));

const exact = new Map(); // en -> {files:Set, hu}
const tpl = new Map(); // pattern -> {files, hu}
const add = (map, key, hu, file, kind) => {
  if (!key || !/[A-Za-z]/.test(key)) return;
  const e = map.get(key) || { files: new Set(), hu: hu ?? null, kind };
  e.files.add(path.relative(ROOT, file));
  if (hu && !e.hu) e.hu = hu;
  map.set(key, e);
};
const textOf = (n) => {
  if (!n) return null;
  if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) return { s: n.text, tpl: false };
  if (ts.isTemplateExpression(n)) {
    let s = n.head.text;
    n.templateSpans.forEach((sp, i) => (s += `{${i}}` + sp.literal.text));
    return { s, tpl: true };
  }
  if (ts.isParenthesizedExpression(n)) return textOf(n.expression);
  return null;
};
const put = (enNode, huNode, file, kind) => {
  const en = textOf(enNode);
  if (!en) return;
  const hu = textOf(huNode);
  add(en.tpl ? tpl : exact, en.s, hu?.s, file, kind);
};
const HELPERS = new Set(['t', 'T', 'L', 'tx', 'T2']);

for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const visit = (n) => {
    if (ts.isCallExpression(n)) {
      const c = n.expression;
      const name = ts.isIdentifier(c) ? c.text : ts.isPropertyAccessExpression(c) ? c.name.text : '';
      const a = n.arguments;
      if (HELPERS.has(name)) {
        // t(en, hu) or tx(lang, en, hu) / L(lang, en, hu)
        if (a.length >= 3 && textOf(a[1])) put(a[1], a[2], file, 'call');
        else if (a.length >= 2) put(a[0], a[1], file, 'call');
      }
    }
    if (ts.isObjectLiteralExpression(n)) {
      const props = {};
      for (const p of n.properties) if (ts.isPropertyAssignment(p) && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name))) props[p.name.text] = p.initializer;
      if (props.en && props.hu) {
        if (ts.isArrayLiteralExpression(props.en)) {
          const huArr = ts.isArrayLiteralExpression(props.hu) ? props.hu.elements : [];
          props.en.elements.forEach((el, i) => put(el, huArr[i], file, 'obj'));
        } else put(props.en, props.hu, file, 'obj');
      }
      // server error messages: json({ error: '...' })
      if (props.error && (file.includes('/api/') || file.includes('/lib/'))) put(props.error, null, file, 'err');
    }
    // ['English', 'Magyar'] pairs (tuples used with t(...pair))
    if (ts.isArrayLiteralExpression(n) && n.elements.length >= 2) {
      const el = n.elements.map((e) => textOf(e));
      const HU = /[áéíóöőúüűÁÉÍÓÖŐÚÜŰ]/;
      for (let i = 1; i < el.length; i++) if (el[i] && el[i - 1] && HU.test(el[i].s) && !HU.test(el[i - 1].s)) put(n.elements[i - 1], n.elements[i], file, 'pair');
    }
    // new Error('...') messages shown to people
    if (ts.isNewExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'Error' && n.arguments?.length) put(n.arguments[0], null, file, 'err');
    ts.forEachChild(n, visit);
  };
  visit(sf);
}

// the keyed UI dictionary (ui.t('…')) in lib/i18n.ts
{
  const src = fs.readFileSync(path.join(ROOT, 'lib/i18n.ts'), 'utf8');
  const en = src.slice(src.indexOf('const EN = {'), src.indexOf('};', src.indexOf('const EN = {')));
  const hu = src.slice(src.indexOf('const HU'), src.indexOf('};', src.indexOf('const HU')));
  const huMap = Object.fromEntries([...hu.matchAll(/'([\w.]+)':\s*'((?:[^'\\]|\\.)*)'/g)].map((m) => [m[1], m[2]]));
  for (const m of en.matchAll(/'([\w.]+)':\s*'((?:[^'\\]|\\.)*)'/g)) add(exact, m[2].replace(/\\'/g, "'"), huMap[m[1]], path.join(ROOT, 'lib/i18n.ts'), 'key');
}
const out = {
  exact: Object.fromEntries([...exact].map(([k, v]) => [k, { hu: v.hu, files: [...v.files].slice(0, 3), kind: v.kind }])),
  tpl: Object.fromEntries([...tpl].map(([k, v]) => [k, { hu: v.hu, files: [...v.files].slice(0, 3), kind: v.kind }])),
};
fs.writeFileSync(path.join(ROOT, 'scripts/strings.json'), JSON.stringify(out, null, 1));
const chars = (m) => [...m.keys()].reduce((n, k) => n + k.length, 0);
console.log('exact', exact.size, 'chars', chars(exact), '| tpl', tpl.size, 'chars', chars(tpl));
const byDir = {};
for (const [k, v] of exact) for (const f of v.files) { const d = f.split('/').slice(0, 2).join('/'); byDir[d] = (byDir[d] || 0) + k.length; }
console.log(Object.entries(byDir).sort((a, b) => b[1] - a[1]).slice(0, 25));
