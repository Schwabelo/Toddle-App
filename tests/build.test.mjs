import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { build, ORDER } from '../build-single.mjs';

const root = new URL('../', import.meta.url);
const jsFiles = fs.readdirSync(new URL('js/', root)).filter((f) => f.endsWith('.js')).sort();

test('study-hub.html matches the source (run: node build-single.mjs)', () => {
  assert.equal(fs.readFileSync(new URL('study-hub.html', root), 'utf8'), build());
});

test('every module is in the single-file build', () => {
  assert.deepEqual([...ORDER].map((n) => `${n}.js`).sort(), jsFiles);
});

test('the service worker caches every module and the font', () => {
  const sw = fs.readFileSync(new URL('sw.js', root), 'utf8');
  for (const f of jsFiles) assert.ok(sw.includes(`'js/${f}'`), `sw.js is missing js/${f}`);
  assert.ok(sw.includes("'fonts/nunito-latin.woff2'"));
});
