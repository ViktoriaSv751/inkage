import { build } from 'esbuild';
import fs from 'fs';
const globals = { react: 'React', 'react-dom': 'ReactDOM', 'react-dom/client': 'ReactDOM', 'react/jsx-runtime': '__JSX' };
const plugin = {
  name: 'globals',
  setup(b) {
    b.onResolve({ filter: /^(react|react-dom|react-dom\/client|react\/jsx-runtime)$/ }, (a) => ({ path: a.path, namespace: 'g' }));
    b.onLoad({ filter: /.*/, namespace: 'g' }, (a) => ({ contents: `module.exports = window.${globals[a.path]};`, loader: 'js' }));
  },
};
const r = await build({
  entryPoints: ['demo/main.tsx'], bundle: true, minify: true, write: false, format: 'iife', target: 'es2019',
  jsx: 'automatic', plugins: [plugin], alias: { '@': '.' },
  define: { 'process.env.NEXT_PUBLIC_STATIC_DEMO': '"1"', 'process.env.NEXT_PUBLIC_SUPABASE_URL': 'undefined', 'process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY': 'undefined', 'process.env.NEXT_PUBLIC_PRICE_WEEKLY_LABEL': '"$5.99 / week"', 'process.env.NEXT_PUBLIC_PRICE_LIFETIME_LABEL': '"$49.99 once"', 'process.env.NODE_ENV': '"production"' },
});
const js = r.outputFiles[0].text.replace(/<\/script/g, '<\\/script');
const css = fs.readFileSync('app/globals.css', 'utf8');
const html = `<title>InkAge</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700;900&family=Instrument+Sans:wght@400;600;700&display=swap">
<style>:root{color-scheme:light}\n${css}</style>
<div id="root"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>
<script>window.__JSX={jsx:(t,p,k)=>React.createElement(t,k===undefined?p:{...p,key:k}),jsxs:(t,p,k)=>React.createElement(t,k===undefined?p:{...p,key:k}),Fragment:React.Fragment};</script>
<script>${js}</script>`;
fs.mkdirSync('demo/out', { recursive: true });
fs.writeFileSync('demo/out/inkage.html', html);
console.log('bytes', html.length);
