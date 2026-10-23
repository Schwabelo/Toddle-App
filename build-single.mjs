// Bundles the app into one self-contained file (study-hub.html) that works when double-clicked.
// Usage: node build-single.mjs
import fs from 'fs';

const ORDER = ['config', 'util', 'ics', 'store', 'ui', 'sync', 'components', 'timer', 'textmatch', 'planlogic', 'cards', 'planner', 'pages', 'app'];

// Everything shares one scope in the single file, so a repeated top-level name would silently clash.
const names = new Map();
for (const n of ORDER) {
  const src = fs.readFileSync(`js/${n}.js`, 'utf8');
  for (const m of src.matchAll(/^(?:export\s+)?(?:async\s+)?(?:function\*?|const|let|class)\s+([A-Za-z_$][\w$]*)/gm)) {
    if (names.has(m[1])) throw new Error(`Top-level name "${m[1]}" is defined in both ${names.get(m[1])}.js and ${n}.js`);
    names.set(m[1], n);
  }
}

const code = ORDER.map((n) => {
  let src = fs.readFileSync(`js/${n}.js`, 'utf8');
  src = src.replace(/^import [^;]+;\s*$/gm, ''); // single-line imports only
  src = src.replace(/^export (default )?/gm, '');
  return `// ---- ${n}.js ----\n${src}`;
}).join('\n');

const css = fs.readFileSync('styles.css', 'utf8');
const icon = 'data:image/svg+xml;base64,' + fs.readFileSync('icon.svg').toString('base64');
let html = fs.readFileSync('index.html', 'utf8');
// The scheduler is embedded as text and loaded into its frame with srcdoc, so no second file is needed.
const scheduler = JSON.stringify(fs.readFileSync('scheduler.html', 'utf8')).replace(/<\//g, '<\\/');

html = html
  .replace(/<link rel="manifest"[^>]*>\n?/, '')
  .replace(/<link rel="apple-touch-icon"[^>]*>\n?/, '')
  .replace(/<link rel="icon" href="icon.svg"/, `<link rel="icon" href="${icon}"`)
  .replace(/<link rel="stylesheet" href="styles.css">/, () => `<style>\n${css}</style>`)
  .replace(/<img src="icon.svg"/, `<img src="${icon}"`)
  .replace(/<script type="module" src="js\/app.js"><\/script>/, () => `<script>\nwindow.SCHEDULER_SRCDOC = ${scheduler};\n</script>\n<script>\n(() => {\n'use strict';\n${code}\n})();\n</script>`);

fs.writeFileSync('study-hub.html', html);
console.log(`study-hub.html written (${Math.round(html.length / 1024)} KB)`);
