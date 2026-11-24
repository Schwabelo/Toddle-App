// Bundles the app into one self-contained file (study-hub.html) that works when double-clicked.
// Usage:  node build-single.mjs          write study-hub.html
//         node build-single.mjs --check  fail if study-hub.html is out of date (used by the tests and CI)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const read = (f, enc = 'utf8') => fs.readFileSync(path.join(ROOT, f), enc);

// Order matters: a module's top-level code may only use modules listed before it.
export const ORDER = ['config', 'util', 'urgency', 'enrich', 'ics', 'store', 'ui', 'dialog', 'sync', 'ttlogic', 'timetable', 'components', 'timer', 'textmatch', 'planlogic', 'cards', 'planner', 'alerts', 'todo', 'drawer', 'calendar', 'pages', 'app'];

export function build() {
  // Everything shares one scope in the single file, so a repeated top-level name would silently clash.
  const names = new Map();
  for (const n of ORDER) {
    const src = read(`js/${n}.js`);
    for (const m of src.matchAll(/^(?:export\s+)?(?:async\s+)?(?:function\*?|const|let|class)\s+([A-Za-z_$][\w$]*)/gm)) {
      if (names.has(m[1])) throw new Error(`Top-level name "${m[1]}" is defined in both ${names.get(m[1])}.js and ${n}.js`);
      names.set(m[1], n);
    }
    if (/^import [^;]*$/m.test(src)) throw new Error(`${n}.js has an import that spans several lines; keep imports on one line`);
    if (/^import [^;]*\bas\b/m.test(src)) throw new Error(`${n}.js renames an import with "as", which the single-file build cannot keep`);
    if (/^export \{/m.test(src)) throw new Error(`${n}.js uses "export { … }", which the single-file build cannot strip`);
  }

  const code = ORDER.map((n) => {
    let src = read(`js/${n}.js`);
    src = src.replace(/^import [^;]+;\s*$/gm, ''); // single-line imports only
    src = src.replace(/^export (default )?/gm, '');
    return `// ---- ${n}.js ----\n${src}`;
  }).join('\n');

  const font = 'data:font/woff2;base64,' + read('fonts/nunito-latin.woff2', null).toString('base64');
  const css = read('styles.css').replace('url("fonts/nunito-latin.woff2")', `url("${font}")`);
  const icon = 'data:image/svg+xml;base64,' + read('icon.svg', null).toString('base64');
  // The scheduler is embedded as text and loaded into its frame with srcdoc, so no second file is needed.
  const scheduler = JSON.stringify(read('scheduler.html')).replace(/<\//g, '<\\/');

  return read('index.html')
    .replace(/<link rel="manifest"[^>]*>\n?/, '')
    .replace(/<link rel="apple-touch-icon"[^>]*>\n?/, '')
    .replace(/<link rel="icon" href="icon.svg"/, `<link rel="icon" href="${icon}"`)
    .replace(/<link rel="stylesheet" href="styles.css">/, () => `<style>\n${css}</style>`)
    .replace(/<img src="icon.svg"/, `<img src="${icon}"`)
    .replace(/<script type="module" src="js\/app.js"><\/script>/, () => `<script>\nwindow.SCHEDULER_SRCDOC = ${scheduler};\n</script>\n<script>\n(() => {\n'use strict';\n${code}\n})();\n</script>`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const html = build();
  const out = path.join(ROOT, 'study-hub.html');
  if (process.argv.includes('--check')) {
    const current = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';
    if (current !== html) {
      console.error('study-hub.html is out of date. Run: node build-single.mjs');
      process.exit(1);
    }
    console.log('study-hub.html is up to date');
  } else {
    fs.writeFileSync(out, html);
    console.log(`study-hub.html written (${Math.round(html.length / 1024)} KB)`);
  }
}
