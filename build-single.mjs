// Bundles the app into one self-contained file (study-hub.html) that works when double-clicked.
// Usage: node build-single.mjs
import fs from 'fs';

const ORDER = ['util', 'ics', 'store', 'ui', 'sync', 'components', 'timer', 'cards', 'pages', 'app'];

const code = ORDER.map((n) => {
  let src = fs.readFileSync(`js/${n}.js`, 'utf8');
  src = src.replace(/^import [^;]+;\s*$/gm, ''); // single-line imports only
  src = src.replace(/^export (default )?/gm, '');
  return `// ---- ${n}.js ----\n${src}`;
}).join('\n');

const css = fs.readFileSync('styles.css', 'utf8');
const icon = 'data:image/svg+xml;base64,' + fs.readFileSync('icon.svg').toString('base64');
let html = fs.readFileSync('index.html', 'utf8');

html = html
  .replace(/<link rel="manifest"[^>]*>\n?/, '')
  .replace(/<link rel="apple-touch-icon"[^>]*>\n?/, '')
  .replace(/<link rel="icon" href="icon.svg"/, `<link rel="icon" href="${icon}"`)
  .replace(/<link rel="stylesheet" href="styles.css">/, () => `<style>\n${css}</style>`)
  .replace(/<img src="icon.svg"/, `<img src="${icon}"`)
  .replace(/<script type="module" src="js\/app.js"><\/script>/, () => `<script>\n(() => {\n'use strict';\n${code}\n})();\n</script>`);

fs.writeFileSync('study-hub.html', html);
console.log(`study-hub.html written (${Math.round(html.length / 1024)} KB)`);
