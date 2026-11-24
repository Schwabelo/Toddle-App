import test from 'node:test';
import assert from 'node:assert/strict';
import { lessonsFor, cycleWeek, cycleLength, matchClass } from '../js/ttlogic.js';

const P = (start, end, meets) => ({ type: 'period', name: '', start, end, meets });
const days = { Mon: { on: true }, Tue: { on: true }, Wed: { on: true }, Thu: { on: true }, Fri: { on: true }, Sat: { on: false }, Sun: { on: false } };
const week = (mon) => ({ Mon: mon, Tue: [], Wed: [], Thu: [], Fri: [], Sat: [], Sun: [] });
const data = {
  classes: [
    { id: 'm', name: 'Maths', weeks: 2, sched: { days, tl: [week([P('08:00', '08:45', true), P('09:00', '09:45', false), P('10:00', '10:45', false)]), week([P('08:00', '08:45', false), P('09:00', '09:45', false), P('10:00', '10:45', false)])] } },
    { id: 's', name: 'Science', weeks: 1, sched: { days, tl: [week([P('08:00', '08:45', false), P('09:00', '09:45', true), P('10:00', '10:45', false)])] } },
  ],
};

test('lists lessons and free periods for a day, following a 2-week cycle', () => {
  assert.equal(cycleLength(data), 2);
  const links = { m: 'Maths Extended (8XY)', s: 'MYP Sciences (8XY Sci)' };
  const w1 = lessonsFor(data, '2026-11-23', { anchor: '2026-11-23', links });
  assert.deepEqual(w1.lessons.map((l) => [l.cls, l.start, l.num]), [['Maths Extended (8XY)', '08:00', 1], ['MYP Sciences (8XY Sci)', '09:00', 2]]);
  assert.deepEqual(w1.free.map((p) => p.num), [3]);
  const w2 = lessonsFor(data, '2026-11-30', { anchor: '2026-11-23', links });
  assert.deepEqual(w2.lessons.map((l) => l.id), ['s']); // Maths does not meet on Monday of week 2
  assert.equal(lessonsFor(data, '2026-11-28').lessons.length, 0); // Saturday
});

test('cycle week counts from any day of week 1, also backwards', () => {
  assert.equal(cycleWeek('2026-11-27', '2026-11-25', 2), 0);
  assert.equal(cycleWeek('2026-12-02', '2026-11-25', 2), 1);
  assert.equal(cycleWeek('2026-11-18', '2026-11-25', 2), 1);
  assert.equal(cycleWeek('2026-11-18', '', 2), 0);
});

test('matches timetable names to Toddle classes', () => {
  const toddle = ['Maths Extended (8GS/8KE)', 'MYP Sciences (8KE Sci)', 'MYP Lang & Lit: English A (8KE Eng)', 'MYP Individuals & Societies (8KE I+S)'];
  assert.equal(matchClass('Science', toddle), 'MYP Sciences (8KE Sci)');
  assert.equal(matchClass('Math', toddle), 'Maths Extended (8GS/8KE)');
  assert.equal(matchClass('English', toddle), 'MYP Lang & Lit: English A (8KE Eng)');
  assert.equal(matchClass('Individuals and Societies', toddle), 'MYP Individuals & Societies (8KE I+S)');
  assert.equal(matchClass('Lunch club', toddle), '');
});
