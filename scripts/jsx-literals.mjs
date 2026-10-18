import ts from 'typescript'; import fs from 'fs'; import path from 'path';
const out=[]; const walk=(d)=>{for(const f of fs.readdirSync(d)){const p=path.join(d,f); if(['node_modules','.next','locales'].includes(f))continue; if(fs.statSync(p).isDirectory())walk(p); else if(p.endsWith('.tsx'))scan(p);}};
function scan(p){const sf=ts.createSourceFile(p,fs.readFileSync(p,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const v=(n)=>{ if(ts.isJsxText(n)){const t=n.text.trim(); if(/[A-Za-zÁ-ű]{3,}/.test(t)) out.push(p+': '+t.slice(0,80));}
  if(ts.isJsxAttribute(n)&&n.initializer&&ts.isStringLiteral(n.initializer)&&['placeholder','aria-label','title','alt','label'].includes(n.name.getText())&&/[A-Za-z]{3,}/.test(n.initializer.text)) out.push(p+': @'+n.name.getText()+'='+n.initializer.text.slice(0,60));
  ts.forEachChild(n,v)}; v(sf);}
walk('app'); console.log(out.length); console.log(out.join('\n'));
