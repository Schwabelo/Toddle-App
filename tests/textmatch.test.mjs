import test from 'node:test';
import assert from 'node:assert/strict';
import { norm, judge, parseBulk, splitLine } from '../js/textmatch.js';

test('norm ignores case, accents, punctuation and spacing', () => {
  assert.equal(norm('  Café,  AU  lait! '), 'cafe au lait');
});

test('judge: exact, alternatives and brackets', () => {
  assert.equal(judge('Mitochondria', 'mitochondria'), 'correct');
  assert.equal(judge('cafe', 'Café'), 'correct');
  assert.equal(judge('no', 'yes / no'), 'correct');
  assert.equal(judge('mitochondria', 'mitochondria (organelle)'), 'correct');
});

test('judge: typos are "almost", wrong answers and blanks are wrong', () => {
  assert.equal(judge('mitochondira', 'mitochondria'), 'almost');
  assert.equal(judge('nucleus', 'ribosome'), 'wrong');
  assert.equal(judge('', 'anything'), 'wrong');
  assert.equal(judge('cat', 'cut'), 'wrong'); // too short to forgive
});

test('judge: a wrong number is never "almost"', () => {
  assert.equal(judge('12346', '12345'), 'wrong');
  assert.equal(judge('12345', '12345'), 'correct');
});

test('splitLine: auto separators in priority order', () => {
  assert.deepEqual(splitLine('term\tdefinition'), { front: 'term', back: 'definition' });
  assert.deepEqual(splitLine('well-known ; famous'), { front: 'well-known', back: 'famous' });
  assert.deepEqual(splitLine('Paris - capital of France'), { front: 'Paris', back: 'capital of France' });
  assert.deepEqual(splitLine('H2O = water'), { front: 'H2O', back: 'water' });
  assert.deepEqual(splitLine('perro, dog'), { front: 'perro', back: 'dog' });
  assert.equal(splitLine('no separator here'), null);
});

test('splitLine: explicit separator only uses that one', () => {
  assert.equal(splitLine('a ; b', 'comma'), null);
  assert.deepEqual(splitLine('key: value', 'colon'), { front: 'key', back: 'value' });
});

test('parseBulk counts cards and skipped lines', () => {
  const r = parseBulk('a ; b\n\nbroken line\nc\td\n');
  assert.equal(r.cards.length, 2);
  assert.equal(r.skipped, 1);
});
