// App state, persisted in localStorage. Nothing leaves the browser.
import { today, addDays } from './util.js';
import { isOverdue, dueConfig, dueMs } from './urgency.js';
import { defaultKind, assignColors, teachersByClass } from './enrich.js';

const KEY = 'toddle-study-hub:v1';
export const SCHEDULER_KEY = 'classScheduler.v2'; // owned by the embedded scheduler (scheduler.html)

const defaults = () => ({
  settings: {
    name: '',
    theme: 'auto',
    accent: '#d63a3f',
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
    dailyLimit: 90,
    defaultEst: 30,
    planWeekends: false,
    alerts: true,
    warnHours: 24,
    warnAssessDays: 3,
    alertNotify: false,
    autoSync: true,
    dueAtEnd: false, // Toddle deadline = end of the 30-min slot instead of the start
    prepSessions: true, // add "Revise" sessions before summatives in the planner
    prepMin: 45,
    cycleAnchor: '', // a day in Week 1 of the timetable cycle
  },
  feedUrl: '',
  events: [],
  lastSync: null,
  pastPrompted: false,
  done: {}, // uid -> date completed
  status: {}, // uid -> 'todo' | 'material': overrides the guess from defaultKind()
  classColors: {}, // class name -> colour, assigned once so colours never shift
  catchupBefore: null, // ms: past work due before the first import, offered for a one-time clean-up
  ttMap: {}, // timetable (scheduler) class id -> Toddle class name ('' = not linked)
  plan: {}, // uid -> day it is planned for
  est: {}, // uid -> estimated minutes
  mute: {}, // uid -> true: stop warning about this one
  changes: [], // new or moved assignments found by the last imports: { uid, kind, from?, at }
  notified: {}, // uid -> last alert level a notification was sent for
  decks: [],
  sessions: [], // { date, minutes, cls }
  reviews: {}, // date -> flashcards reviewed
});

function load() {
  const base = defaults();
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (raw) {
      const settings = { ...base.settings, ...(raw.settings || {}) };
      if (settings.accent === '#4f46e5') settings.accent = base.settings.accent; // old default -> Toddle-style red
      return { ...base, ...raw, settings };
    }
  } catch (e) {
    console.warn('Could not read saved data', e);
  }
  return base;
}

export const state = load();
dueConfig.end = Boolean(state.settings.dueAtEnd);

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

// 'todo', 'material' (class material, nothing to hand in) or 'event'.
export const kindOf = (e) => (e.kind === 'task' ? state.status[e.uid] || defaultKind(e) : 'event');
export const isTodo = (e) => kindOf(e) === 'todo';
export const todos = () => tasks().filter(isTodo);
export const todosFor = (cls) => todos().filter((e) => e.classes.includes(cls));

// The three states a student can pick: to do, done, or not homework (class material).
export function setStatus(uid, s) {
  if (s === 'material') {
    state.status[uid] = 'material';
    delete state.done[uid];
  } else {
    state.status[uid] = 'todo';
    if (s === 'done') state.done[uid] ||= today();
    else delete state.done[uid];
  }
  save();
}
// Past work waiting in the one-time catch-up (see todo.js). It stays out of warnings and the planner until sorted.
export const isCatchup = (e) =>
  Boolean(state.catchupBefore) && kindOf(e) === 'todo' && !isDone(e.uid) && !state.status[e.uid] && dueMs(e) < state.catchupBefore;
export const statusOf = (e) => (kindOf(e) === 'material' ? 'material' : isDone(e.uid) ? 'done' : 'todo');

// `mark` is the completion date; bulk actions pass 'bulk' so they don't count toward the streak.
export function toggleDone(uid, mark = today()) {
  if (state.done[uid]) delete state.done[uid];
  else state.done[uid] = mark;
  save();
}


// Colours are handed out once per class and saved, so a new class never shifts the others.
export function ensureClassColors() {
  const names = classNames();
  if (names.every((n) => state.classColors[n])) return;
  state.classColors = assignColors(names, state.classColors);
  save();
}

export function classColor(name) {
  if (!name) return '#94a3b8';
  if (!state.classColors[name] && classNames().includes(name)) ensureClassColors();
  return state.classColors[name] || '#94a3b8';
}

let teacherCache = { events: null, map: {} };
export function classTeachers(name) {
  if (teacherCache.events !== state.events) teacherCache = { events: state.events, map: teachersByClass(state.events) };
  return teacherCache.map[name] || [];
}

// School closures (holidays, in-service days) by date: { 'YYYY-MM-DD': 'Winter Break - School Closed' }
export function closures() {
  const out = {};
  for (const e of state.events) {
    if (e.type !== 'Holidays and vacations') continue;
    for (let d = e.date, n = 0; d <= e.endDate && n < 60; d = addDays(d, 1), n++) out[d] = e.title;
  }
  return out;
}

export function classInfo(full) {
  const m = full.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
  return { full, name: (m ? m[1] : full).replace(/^MYP\s+/, ''), code: m ? m[2] : '', color: classColor(full) };
}

export function classStats(cls) {
  const list = todosFor(cls);
  const done = list.filter((e) => isDone(e.uid));
  const open = list.filter((e) => !isDone(e.uid));
  const overdue = open.filter((e) => isOverdue(e));
  const upcoming = open.filter((e) => !isOverdue(e)); // same rule as the alerts: the exact due moment
  return { total: list.length, done: done.length, open: open.length, overdue: overdue.length, upcoming: upcoming.length, next: upcoming[0] || null };
}

export function studyMinutesOn(date) {
  return state.sessions.filter((s) => s.date === date).reduce((a, s) => a + s.minutes, 0);
}
