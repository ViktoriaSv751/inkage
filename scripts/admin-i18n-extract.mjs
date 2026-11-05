// Collects every Hungarian text of the admin (JSX text, string literals, template literals and "a" + x + "b"
// concatenations) into scripts/admin-i18n/strings.json, and lists the ones lib/admin-i18n/en.json does not
// translate yet in scripts/admin-i18n/missing.json. Run after porting new admin pages from Calligra:
//   node scripts/admin-i18n-extract.mjs
// A dynamic part becomes {0}, {1}…: "{0} előnézet ma".
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dirs = ["app/admin", "lib/admin"];
const files = [];
const walk = (d) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else if (/\.(tsx?|mjs)$/.test(f.name) && !/mock\.ts$/.test(f.name)) files.push(p); } };
dirs.forEach((d) => walk(path.join(root, d)));

const HU = /[áéíóöőúüűÁÉÍÓÖŐÚÜŰ]|\b(a|az|és|nem|van|nincs|ma|még|ez|egy|vagy|ide|itt|mi|hány|mert|ha|óra|nap|hét|perc|fiók|oldal|minden|csak|új)\b/i;
const CODE = /^[\w.\-/:#?=&%@+*,;()[\]{}<>|!~^$'"`\\]*$/; // no spaces and no accents: a key, class, URL or code
const out = new Map();
const add = (s, where, jsx = false) => {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length < 2 || !/[a-záéíóöőúüű]/i.test(t)) return;
  if (!HU.test(t) && !/^[A-Z][a-z]{1,20}$/.test(t) && !(jsx && /^[A-Za-z]{2,}$/.test(t))) return;
  if (CODE.test(t) && !/[áéíóöőúüű]/i.test(t) && !/^[A-Z][a-z]{1,20}$/.test(t) && !jsx) return;
  if (/^(https?:|#|var\(|rgba?\()/.test(t) || /^\.[\w-]+$/.test(t) || (/^\//.test(t) && !/^\/[a-záéíóöőúüű]{2,6}$/.test(t))) return;
  if (!out.has(t)) out.set(t, where);
};

function pattern(node) {
  // "a" + x + "b" or `a ${x} b` → "a {0} b"; null when there is no literal part
  const parts = []; let k = 0; let lit = false;
  const flat = (n) => {
    if (ts.isParenthesizedExpression(n)) return flat(n.expression);
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.PlusToken) { flat(n.left); flat(n.right); return; }
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) { parts.push(n.text); lit = true; return; }
    if (ts.isTemplateExpression(n)) { parts.push(n.head.text); lit = true; n.templateSpans.forEach((sp) => { parts.push(`{${k++}}`); parts.push(sp.literal.text); }); return; }
    parts.push(`{${k++}}`);
  };
  flat(node);
  return lit ? parts.join("") : null;
}

for (const f of files) {
  const src = ts.createSourceFile(f, fs.readFileSync(f, "utf8"), ts.ScriptTarget.Latest, true, f.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const rel = path.relative(root, f);
  const visit = (n) => {
    if (ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) return;
    if (ts.isJsxText(n)) { add(n.text, rel, true); return; }
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.PlusToken && !(ts.isBinaryExpression(n.parent) && n.parent.operatorToken.kind === ts.SyntaxKind.PlusToken)) {
      const p = pattern(n); if (p && /\{\d+\}/.test(p)) add(p, rel);
    }
    if (ts.isTemplateExpression(n)) { const p = pattern(n); if (p) add(p, rel); }
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) {
      const par = n.parent;
      // skip property keys, rpc names, css classes, element keys, comparisons with keys
      if (par && (ts.isPropertyAssignment(par) && par.name === n)) return;
      if (par && ts.isJsxAttribute(par) && /^(className|key|href|src|id|type|name|role|style|d|viewBox|fill|stroke|rel|target|htmlFor|inputMode|autoComplete)$/.test(par.name.getText())) return;
      if (par && ts.isElementAccessExpression(par)) return;
      add(n.text, rel);
    }
    ts.forEachChild(n, visit);
  };
  visit(src);
}

/* the database functions write Hungarian too (signals, alerts, labels): their literals, and 'a' || x || 'b' chains as "a{0}b" */
const sqlFiles = fs.readdirSync(path.join(root, "supabase")).filter((f) => /admin|fixes|followup|list-fixes/.test(f) && f.endsWith(".sql")).map((f) => path.join(root, "supabase", f));
for (const f of sqlFiles) {
  const t = fs.readFileSync(f, "utf8"); const rel = path.relative(root, f);
  const toks = []; let i = 0;
  while (i < t.length) {
    if (t[i] === "-" && t[i + 1] === "-") { const e = t.indexOf("\n", i); i = e < 0 ? t.length : e; continue; }
    if (t[i] === "'" && !/[A-Za-z0-9_]/.test(t[i - 1] || "")) { let j = i + 1, v = ""; while (j < t.length) { if (t[j] === "'" && t[j + 1] === "'") { v += "'"; j += 2; continue; } if (t[j] === "'") break; v += t[j++]; } toks.push({ lit: v }); i = j + 1; continue; }
    if (t[i] === "|" && t[i + 1] === "|") { toks.push({ cat: true }); i += 2; continue; }
    let j = i; while (j < t.length && t[j] !== "'" && !(t[j] === "|" && t[j + 1] === "|") && !(t[j] === "-" && t[j + 1] === "-")) j++;
    if (j === i) j = i + 1; // a quote inside a word (E'…', it's) is just text here
    toks.push({ other: t.slice(i, j) }); i = j;
  }
  // chains: lit (|| operand || lit)*
  for (let k = 0; k < toks.length; k++) {
    if (toks[k].lit == null) continue;
    add(toks[k].lit, rel);
    let p = toks[k].lit, n = 0, m = k, joined = false;
    while (toks[m + 1]?.cat) {
      const nx = toks[m + 2];
      if (nx?.lit != null) { p += nx.lit; m += 2; joined = true; continue; }
      if (nx?.other != null && toks[m + 3]?.cat) { p += `{${n++}}`; m += 2; joined = true; continue; }
      if (nx?.other != null) { p += `{${n++}}`; joined = true; }
      break;
    }
    if (joined && /\{\d+\}/.test(p)) add(p, rel);
  }
}

const dir = path.join(root, "scripts/admin-i18n"); fs.mkdirSync(dir, { recursive: true });
const all = [...out.keys()].sort();
fs.writeFileSync(path.join(dir, "strings.json"), JSON.stringify(all, null, 1));
let en = {}; try { en = JSON.parse(fs.readFileSync(path.join(root, "lib/admin-i18n/en.json"), "utf8")); } catch {}
const missing = all.filter((s) => !(s in en));
fs.writeFileSync(path.join(dir, "missing.json"), JSON.stringify(missing, null, 1));
console.log(`${all.length} Hungarian texts, ${missing.length} without English`);
