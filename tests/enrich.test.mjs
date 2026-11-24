import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseIcs } from '../js/ics.js';
import { sanitizeHtml, htmlToText, extractLinks, resourceOf, criteriaOf, defaultKind, topicGroups, assignColors, teachersByClass, PALETTE } from '../js/enrich.js';

// Made-up feed in Toddle's exact shape (no real student data).
const sample = () => parseIcs(fs.readFileSync(new URL('./fixtures/sample.ics', import.meta.url), 'utf8'));

test('reads links that only exist in the HTML description (X-ALT-DESC)', () => {
  const e = sample().find((x) => x.uid === 'sample-slides');
  assert.deepEqual(e.links, [{ href: 'https://docs.google.com/presentation/d/SAMPLE/edit', text: 'Slides: Plant Cells' }]);
  assert.match(e.html, /<a href="https:\/\/docs\.google\.com\/presentation\/d\/SAMPLE\/edit" target="_blank" rel="noopener noreferrer">Slides: Plant Cells<\/a>/);
  assert.equal(resourceOf(e.links[0]).kind, 'slides');
});

test('keeps paragraph breaks and strips scripts, event handlers and javascript: links', () => {
  const e = sample().find((x) => x.uid === 'sample-letter');
  assert.equal(e.description.split('\n')[0], 'Dear students,');
  assert.equal(e.html, '<p>Dear students,</p><p>Please complete the <b>questionnaire</b>.</p><p>bad</p>');
  assert.doesNotMatch(e.html, /script|onerror|javascript/i);
});

test('removes the escaped tab Toddle leaves in some titles', () => {
  assert.equal(sample().find((x) => x.uid === 'sample-letter').title, 'HML: Worksheet 3');
});

test('ignores a "View Task" link that is not on toddleapp.com', () => {
  assert.equal(sample().find((x) => x.uid === 'sample-summative').link, '');
});

test('sanitizer escapes text and closes open tags', () => {
  assert.equal(sanitizeHtml('<p>1 &lt; 2 & <i>x'), '<p>1 &lt; 2 &amp; <i>x</i></p>');
  assert.equal(sanitizeHtml('<div>a</div><div>b</div>'), '<p>a</p><p>b</p>');
  assert.equal(htmlToText('<p>a</p><ul><li>b</li></ul>'), 'a\n• b');
  assert.deepEqual(extractLinks('', 'see https://ixl.com/x.'), [{ href: 'https://ixl.com/x', text: '' }]);
});

test('finds MYP criteria in the ways teachers write them', () => {
  const cases = {
    'Criterion A - Cells Test': 'A', 'Science - Crit D- Diagnostic Imaging Reflection': 'D', 'Criteria B Assessment - Patterns': 'B',
    'B, C, D Industrial Revolution Summative': 'BCD', 'Greenhouse Gases CD Formative': 'CD', 'Linear Functions Criteria CD Assessment': 'CD',
    'A- Short Answer Test': 'A', '🏠 Lesson 2 Finish Gradient Crit B Practice (Lightbulbs)': 'B',
    'A Summary of the Unit': '', 'Critical thinking task': '', 'Lesson 5 Homework': '', 'Criteria based reflection': '',
  };
  for (const [title, want] of Object.entries(cases)) assert.equal(criteriaOf(title).join(''), want, title);
});

test('sorts tasks into to-do and class material', () => {
  const k = (title, type = 'Learning Experience', extra = {}) => defaultKind({ kind: 'task', title, type, ...extra });
  assert.equal(k('Cell Theory'), 'material');
  assert.equal(k('Summative Assessment Feedback (audio)'), 'material');
  assert.equal(k('Dissection Videos'), 'material');
  assert.equal(k('🏠 Finish the Painted Cube Formulas'), 'todo');
  assert.equal(k('HML: Basketball skills'), 'todo');
  assert.equal(k('Checkpoint: Flash Draft'), 'todo');
  assert.equal(k('History of Microscope', 'Learning Experience', { links: [{ href: 'https://edpuzzle.com/join/x' }] }), 'todo');
  assert.equal(k('Group preferences', 'Learning Experience', { description: 'Please complete the following Google Form' }), 'todo');
  assert.equal(k('Anything', 'Summative Assessment'), 'todo');
  assert.equal(defaultKind({ kind: 'event', title: 'Winter Break', type: 'Holidays and vacations' }), 'event');
});

test('groups titles by shared topics and leaves loners in Other', () => {
  const items = ['Checkpoint: Short Story Plan', 'Short Story: Personal Writing Goals', 'Summative: Short Stories', 'Urbanization and IR', 'Urbanization- data', 'Lesson 1 Homework'].map((title) => ({ title }));
  const g = topicGroups(items);
  assert.deepEqual(g.map((x) => [x.label, x.items.length]), [['Short Story', 3], ['Urbanization', 2], ['Other', 1]]);
});

test('class colours never shift when a new class appears', () => {
  const first = assignColors(['Maths', 'Sciences', 'Design']);
  const later = assignColors(['Arts', 'Maths', 'Sciences', 'Design'], first);
  for (const n of ['Maths', 'Sciences', 'Design']) assert.equal(later[n], first[n]);
  assert.equal(new Set(Object.values(later)).size, 4); // no two classes share a colour
  assert.ok(PALETTE.includes(later.Arts));
});

test('the most frequent creator is the class teacher', () => {
  const t = (createdBy) => ({ kind: 'task', classes: ['Arts'], createdBy });
  assert.deepEqual(teachersByClass([t('B'), t('A'), t('A')]).Arts, ['A', 'B']);
});
