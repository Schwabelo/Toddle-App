import test from 'node:test';
import assert from 'node:assert/strict';
import { wallToMs, dueMs, isOverdue, classify, humanSpan, HOUR, DAY } from '../js/urgency.js';

test('wallToMs: Zurich is UTC+1 in winter and UTC+2 in summer', () => {
  assert.equal(new Date(wallToMs('2026-11-04', '10:15', 'Europe/Zurich')).toISOString(), '2026-11-04T09:15:00.000Z');
  assert.equal(new Date(wallToMs('2026-10-20', '10:00', 'Europe/Zurich')).toISOString(), '2026-10-20T08:00:00.000Z');
});

test('wallToMs: correct across the daylight-saving change (Zurich, 25 Oct 2026)', () => {
  assert.equal(new Date(wallToMs('2026-10-24', '12:00', 'Europe/Zurich')).toISOString(), '2026-10-24T10:00:00.000Z'); // still summer time
  assert.equal(new Date(wallToMs('2026-10-26', '12:00', 'Europe/Zurich')).toISOString(), '2026-10-26T11:00:00.000Z'); // winter time
});

test('wallToMs: another zone, and an unknown zone falls back to the device zone', () => {
  assert.equal(new Date(wallToMs('2026-11-04', '10:00', 'America/New_York')).toISOString(), '2026-11-04T15:00:00.000Z');
  assert.equal(wallToMs('2026-11-04', '10:00', 'Not/AZone'), new Date(2026, 10, 4, 10, 0).getTime());
});

test('items without a time are due at the end of the day', () => {
  const e = { date: '2026-11-04', time: null, tz: 'Europe/Zurich' };
  assert.equal(new Date(dueMs(e)).toISOString(), '2026-11-04T22:59:00.000Z');
});

test('isOverdue compares against the exact due moment, not just the date', () => {
  const e = { date: '2026-11-04', time: '08:30', tz: 'Europe/Zurich' }; // 07:30Z
  assert.equal(isOverdue(e, Date.parse('2026-11-04T07:00:00Z')), false);
  assert.equal(isOverdue(e, Date.parse('2026-11-04T08:00:00Z')), true);
});

const T = (uid, date, time, type = 'Learning Experience') => ({ uid, date, time, type, tz: 'Europe/Zurich' });
const now = Date.parse('2026-11-04T08:00:00Z'); // 09:00 in Zurich

test('classify: overdue, soon, urgent and out-of-window', () => {
  const r = classify([
    T('late', '2026-11-04', '08:00'),   // an hour ago
    T('urgent', '2026-11-04', '11:00'), // in 2 h
    T('today', '2026-11-04', '20:00'),  // in 11 h
    T('tomorrow', '2026-11-05', '08:00'), // in 23 h
    T('later', '2026-11-07', '09:00'),  // in 3 days
  ], { now });
  assert.deepEqual(r.overdue.map((x) => x.e.uid), ['late']);
  assert.deepEqual(r.soon.map((x) => x.e.uid), ['urgent', 'today', 'tomorrow']);
  assert.equal(r.soon[0].urgent, true);
  assert.equal(r.soon[1].urgent, false);
});

test('classify: assessments are flagged earlier (3 days by default)', () => {
  const r = classify([T('test', '2026-11-07', '08:00', 'Summative Assessment'), T('hw', '2026-11-07', '08:00')], { now });
  assert.deepEqual(r.soon.map((x) => x.e.uid), ['test']);
});

test('classify: done and ignored items are skipped, very old overdue is only counted', () => {
  const items = [T('a', '2026-11-04', '08:00'), T('b', '2026-11-04', '08:00'), T('old', '2026-09-01', '08:00')];
  const r = classify(items, { now, isDone: (u) => u === 'a', isMuted: (u) => u === 'b' });
  assert.equal(r.overdue.length, 0);
  assert.equal(r.older, 1);
});

test('classify: overdue assessments come before other overdue work, then most recent first', () => {
  const r = classify([T('hw-new', '2026-11-04', '07:00'), T('hw-old', '2026-11-01', '07:00'), T('test-old', '2026-10-30', '07:00', 'Summative Assessment')], { now });
  assert.deepEqual(r.overdue.map((x) => x.e.uid), ['test-old', 'hw-new', 'hw-old']);
});

test('classify: the warning window is adjustable', () => {
  const items = [T('x', '2026-11-05', '08:00')]; // in 23 h
  assert.equal(classify(items, { now, warnHours: 12 }).soon.length, 0);
  assert.equal(classify(items, { now, warnHours: 48 }).soon.length, 1);
});

test('humanSpan', () => {
  assert.equal(humanSpan(20 * 1000), 'less than a minute');
  assert.equal(humanSpan(45 * 60e3), '45 min');
  assert.equal(humanSpan(3 * HOUR), '3 h');
  assert.equal(humanSpan(3 * DAY), '3 days');
});
