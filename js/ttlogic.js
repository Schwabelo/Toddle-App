// Pure timetable logic over the Class Scheduler's saved data (see scheduler.html for the format):
// data.classes[] = { id, name, weeks, sched: { days: { Mon: { on } }, tl: [week][day] -> blocks } }
// block = { type: 'period' | 'lunch' | …, name, start: 'HH:MM', end, meets }
import { parseYmd, diffDays, addDays } from './util.js';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const gcdOf = (a, b) => (b ? gcdOf(b, a % b) : a);

export const cycleLength = (data) => (data ? data.classes.reduce((l, c) => (l * (c.weeks || 1)) / gcdOf(l, c.weeks || 1), 1) : 1);

const mondayOf = (d) => addDays(d, -((parseYmd(d).getDay() + 6) % 7));

/** Which week of the cycle (0-based) a date falls in. anchor = any day in Week 1. */
export function cycleWeek(date, anchor, length) {
  if (length <= 1 || !anchor) return 0;
  const n = Math.floor(diffDays(mondayOf(date), mondayOf(anchor)) / 7);
  return ((n % length) + length) % length;
}

const foldName = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').trim();
const stem = (w) => w.slice(0, 4);

/** Best Toddle class for a scheduler class name ("Science" -> "MYP Sciences (8KE Sci)"), or '' when nothing fits. */
export function matchClass(name, toddleClasses, shortName = (n) => n) {
  const want = foldName(name).split(/\s+/).filter((w) => w.length > 1).map(stem);
  if (!want.length) return '';
  let best = '';
  let bestScore = 0;
  for (const full of toddleClasses) {
    const have = new Set(foldName(shortName(full) + ' ' + full).split(/\s+/).map(stem));
    const score = want.filter((w) => have.has(w)).length / want.length;
    if (score > bestScore) { best = full; bestScore = score; }
  }
  return bestScore >= 0.5 ? best : '';
}

/** Lessons (periods your classes meet in) and free periods on a date. */
export function lessonsFor(data, date, { anchor = '', links = {} } = {}) {
  const day = WEEKDAYS[parseYmd(date).getDay()];
  const week = cycleWeek(date, anchor, cycleLength(data));
  const lessons = [];
  const periods = new Map(); // "start-end" -> { start, end, busy }
  for (const c of data.classes) {
    if (!c.sched?.days?.[day]?.on) continue;
    const blocks = c.sched.tl?.[week % (c.weeks || 1)]?.[day] || [];
    const sorted = [...blocks].sort((a, b) => a.start.localeCompare(b.start));
    let num = 0;
    for (const b of sorted) {
      if (b.type !== 'period') continue;
      num++;
      const key = `${b.start}-${b.end}`;
      const p = periods.get(key) || { start: b.start, end: b.end, num, busy: false };
      if (b.meets) {
        p.busy = true;
        lessons.push({ id: c.id, name: c.name, cls: links[c.id] || '', start: b.start, end: b.end, num });
      }
      periods.set(key, p);
    }
  }
  lessons.sort((a, b) => a.start.localeCompare(b.start));
  const free = [...periods.values()].filter((p) => !p.busy).sort((a, b) => a.start.localeCompare(b.start)).map(({ start, end, num }) => ({ start, end, num }));
  return { lessons, free };
}
