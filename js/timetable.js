// Links the Class Scheduler (scheduler.html) to Toddle classes, so the app knows when your lessons
// and free periods are. The scheduler owns its data; this module only reads it.
import { state, SCHEDULER_KEY, classNames, classInfo, closures } from './store.js';
import { today, addDays, fmtDate, fmtTime } from './util.js';
import { lessonsFor, cycleLength, matchClass } from './ttlogic.js';

export function schedulerData() {
  try {
    const raw = JSON.parse(localStorage.getItem(SCHEDULER_KEY) || 'null');
    return raw && Array.isArray(raw.classes) ? raw : null;
  } catch (e) {
    return null;
  }
}

// Scheduler class id -> Toddle class name, using the saved choice or a best guess by name.
export function linkMap(data = schedulerData()) {
  const out = {};
  if (!data) return out;
  const toddle = classNames();
  for (const c of data.classes) {
    out[c.id] = c.id in state.ttMap ? state.ttMap[c.id] : matchClass(c.name, toddle, (n) => classInfo(n).name);
  }
  return out;
}

export const hasTimetable = () => Boolean(schedulerData()?.classes.length);

/** Lessons and free periods on a date: { lessons: [{ cls, name, start, end, num }], free: [{ start, end, num }] } */
export function dayTimetable(date) {
  const data = schedulerData();
  if (!data || closures()[date]) return { lessons: [], free: [] };
  return lessonsFor(data, date, { anchor: state.settings.cycleAnchor, links: linkMap(data) });
}

// "Thu 26 Nov · 10:15" for the next lesson of a Toddle class, looking two weeks ahead.
export function nextLessonOf(cls) {
  if (!cls || !hasTimetable()) return null;
  const now = new Date();
  const t = today();
  const hm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  for (let i = 0; i < 15; i++) {
    const d = addDays(t, i);
    const l = dayTimetable(d).lessons.find((x) => x.cls === cls && (i > 0 || x.start > hm));
    if (l) return { date: d, ...l, label: `${i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : fmtDate(d)} · ${fmtTime(l.start, state.settings.time24)}${l.num ? ` (P${l.num})` : ''}` };
  }
  return null;
}

export const timetableCycle = () => cycleLength(schedulerData());
