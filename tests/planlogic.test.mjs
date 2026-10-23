import test from 'node:test';
import assert from 'node:assert/strict';
import { autoPlan } from '../js/planlogic.js';

// Week of Mon 2026-10-26 .. Sun 2026-11-01
const base = { weekStart: '2026-10-26', weekEnd: '2026-11-01', weekends: false, estOf: () => 30 };
const t = (uid, date, time = '10:00') => ({ uid, date, time });

test('never plans after the deadline and spreads work across days', () => {
  const r = autoPlan({ ...base, today: '2026-10-26', load: {}, tasks: [t('a', '2026-10-30'), t('b', '2026-10-30'), t('c', '2026-10-30')] });
  assert.ok(Object.values(r).every((d) => d <= '2026-10-30'));
  assert.equal(new Set(Object.values(r)).size, 3); // three different days
});

test('a task due Monday can only go on Monday', () => {
  const r = autoPlan({ ...base, today: '2026-10-26', load: {}, tasks: [t('a', '2026-10-26')] });
  assert.equal(r.a, '2026-10-26');
});

test('overdue work lands on the first available day, not in the past', () => {
  const r = autoPlan({ ...base, today: '2026-10-28', load: {}, tasks: [t('a', '2026-10-20')] });
  assert.equal(r.a, '2026-10-28');
});

test('many overdue tasks are spread over the week, not stacked on one day', () => {
  const tasks = Array.from({ length: 10 }, (_, i) => t('o' + i, '2026-10-05'));
  const r = autoPlan({ ...base, today: '2026-10-26', load: {}, tasks });
  const perDay = {};
  Object.values(r).forEach((d) => { perDay[d] = (perDay[d] || 0) + 1; });
  assert.deepEqual(Object.keys(perDay).sort(), ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30']);
  assert.ok(Math.max(...Object.values(perDay)) <= 2);
});

test('weekends are skipped unless allowed', () => {
  const tasks = [t('a', '2026-11-01')];
  const off = autoPlan({ ...base, today: '2026-10-31', load: {}, tasks }); // today is Saturday
  assert.equal(off.a, '2026-10-31'); // nothing else allowed, falls back to the first day
  const on = autoPlan({ ...base, today: '2026-10-26', load: {}, tasks });
  assert.ok(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30'].includes(on.a));
});

test('existing load pushes new work to lighter days', () => {
  const r = autoPlan({ ...base, today: '2026-10-26', load: { '2026-10-26': 90, '2026-10-27': 90 }, tasks: [t('a', '2026-10-29')] });
  assert.ok(['2026-10-28', '2026-10-29'].includes(r.a));
});

test('returns null when the whole week is in the past', () => {
  assert.equal(autoPlan({ ...base, today: '2026-11-05', load: {}, tasks: [t('a', '2026-10-30')] }), null);
});

test('earliest deadlines are placed first', () => {
  const r = autoPlan({ ...base, today: '2026-10-26', load: {}, tasks: [t('late', '2026-10-30'), t('soon', '2026-10-27')] });
  assert.ok(r.soon <= '2026-10-27');
});
