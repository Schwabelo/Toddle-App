// App state, persisted in localStorage. Nothing leaves the browser.
import { today } from './util.js';

const KEY = 'toddle-study-hub:v1';
export const SCHEDULER_KEY = 'classScheduler.v2'; // owned by the embedded scheduler (scheduler.html)

const defaults = () => ({
  settings: {
    name: '',
    theme: 'auto',
    accent: '#4f46e5',
    time24: true,
    weekStart: 1,
    hideClosures: false,
    focusMin: 25,
    shortMin: 5,
    longMin: 15,
    longEvery: 4,
    sound: true,
    notify: false,
    proxy: '',
  },
  feedUrl: '',
  events: [],
  lastSync: null,
  pastPrompted: false,
  done: {}, // uid -> date completed
  decks: [],
  sessions: [], // { date, minutes, cls }
  reviews: {}, // date -> flashcards reviewed
});

function load() {
  const base = defaults();
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (raw) return { ...base, ...raw, settings: { ...base.settings, ...(raw.settings || {}) } };
  } catch (e) {
    console.warn('Could not read saved data', e);
  }
  return base;
}

export const state = load();

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Could not save data', e);
  }
}

export function resetAll() {
  try {
    localStorage.removeItem(SCHEDULER_KEY);
    localStorage.removeItem('classScheduler.v1');
  } catch (e) { /* storage unavailable */ }
  Object.keys(state).forEach((k) => delete state[k]);
  Object.assign(state, defaults());
  save();
}

export function replaceWith(data) {
  const base = defaults();
  Object.keys(state).forEach((k) => delete state[k]);
  Object.assign(state, base, data, { settings: { ...base.settings, ...(data.settings || {}) } });
  save();
}

// ---- Derived data ----
export const classNames = () =>
  [...new Set(state.events.flatMap((e) => e.classes))].sort((a, b) => a.localeCompare(b));

export const tasks = () => state.events.filter((e) => e.kind === 'task');
export const tasksFor = (cls) => tasks().filter((e) => e.classes.includes(cls));
export const isDone = (uid) => Boolean(state.done[uid]);

// `mark` is the completion date; bulk actions pass 'bulk' so they don't count toward the streak.
export function toggleDone(uid, mark = today()) {
  if (state.done[uid]) delete state.done[uid];
  else state.done[uid] = mark;
  save();
}

const PALETTE = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#a16207', '#8b5cf6', '#84cc16', '#f97316', '#14b8a6', '#0ea5e9', '#d946ef'];

export function classColor(name) {
  const i = classNames().indexOf(name);
  return i < 0 ? '#94a3b8' : PALETTE[i % PALETTE.length];
}

export function classInfo(full) {
  const m = full.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
  return { full, name: (m ? m[1] : full).replace(/^MYP\s+/, ''), code: m ? m[2] : '', color: classColor(full) };
}

export function classStats(cls) {
  const t = today();
  const list = tasksFor(cls);
  const done = list.filter((e) => isDone(e.uid));
  const open = list.filter((e) => !isDone(e.uid));
  const overdue = open.filter((e) => e.date < t);
  const upcoming = open.filter((e) => e.date >= t);
  return { total: list.length, done: done.length, open: open.length, overdue: overdue.length, upcoming: upcoming.length, next: upcoming[0] || null };
}

export function studyMinutesOn(date) {
  return state.sessions.filter((s) => s.date === date).reduce((a, s) => a + s.minutes, 0);
}
