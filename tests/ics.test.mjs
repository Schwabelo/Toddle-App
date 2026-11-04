import test from 'node:test';
import assert from 'node:assert/strict';
import { parseIcs } from '../js/ics.js';

// A tiny synthetic feed in Toddle's shape (no real data).
const FEED = [
  'BEGIN:VCALENDAR', 'VERSION:2.0',
  'BEGIN:VEVENT', 'UID:task-1', 'DTSTART;TZID=Europe/Zurich:20261104T101500', 'DTEND;TZID=Europe/Zurich:20261104T104500',
  'SUMMARY:Essay \\\\"draft\\\\" 1',
  'DESCRIPTION:\\nTask Type: Summative Assessment\\nClasses: MYP Sciences (8KE Sci)\\nDescription: Write\\, then ',
  ' check\\nCreated By: A Teacher\\nView Task: https://share.example/x',
  'END:VEVENT',
  'BEGIN:VEVENT', 'UID:holiday-1', 'DTSTART;VALUE=DATE:20261221', 'DTEND;VALUE=DATE:20270109', 'SUMMARY:Winter Break',
  'DESCRIPTION:\\nEvent Type: Holidays and vacations', 'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

test('parses a task with its time zone, class and folded description', () => {
  const [t] = parseIcs(FEED);
  assert.equal(t.uid, 'task-1');
  assert.equal(t.kind, 'task');
  assert.equal(t.date, '2026-11-04');
  assert.equal(t.time, '10:15');
  assert.equal(t.tz, 'Europe/Zurich');
  assert.equal(t.type, 'Summative Assessment');
  assert.deepEqual(t.classes, ['MYP Sciences (8KE Sci)']);
  assert.equal(t.description, 'Write, then check');
  assert.equal(t.title, 'Essay "draft" 1');
});

test('all-day multi-day events end on the last day, with no zone', () => {
  const h = parseIcs(FEED).find((e) => e.uid === 'holiday-1');
  assert.equal(h.kind, 'event');
  assert.equal(h.allDay, true);
  assert.equal(h.date, '2026-12-21');
  assert.equal(h.endDate, '2027-01-08');
  assert.equal(h.tz, null);
});
