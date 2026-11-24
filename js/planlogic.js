// Pure planner logic: spread unplanned assignments over the days before their deadlines.
import { addDays, parseYmd } from './util.js';

export const isWeekend = (d) => [0, 6].includes(parseYmd(d).getDay());

/**
 * tasks:  open, unplanned assignments ({ uid, date, time })
 * load:   minutes already planned per day { 'YYYY-MM-DD': minutes }
 * Returns { uid: 'YYYY-MM-DD' }, or null when the week is already over.
 * blocked: dates to avoid like weekends (school closures).
 * Earliest deadlines go first; each task takes the lightest allowed day on or before its deadline
 * (earliest day wins a tie). Overdue work is spread over the whole week, starting from the first day still available.
 */
export function autoPlan({ tasks, load, today, weekStart, weekEnd, weekends, estOf, blocked = new Set() }) {
  const first = today > weekStart ? today : weekStart;
  if (first > weekEnd) return null;
  const days = [];
  for (let d = first; d <= weekEnd; d = addDays(d, 1)) days.push(d);
  const loads = { ...load };
  const out = {};
  const order = [...tasks].sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
  for (const t of order) {
    // Overdue work has no live deadline left, so it may use any day this week; the rest must land by its due date.
    const deadline = t.date < first || t.date > weekEnd ? weekEnd : t.date;
    let candidates = days.filter((d) => d <= deadline);
    // Weekends and school closures (holidays, in-service days) are skipped unless weekends are allowed.
    const allowed = weekends ? candidates : candidates.filter((d) => !isWeekend(d) && !blocked.has(d));
    if (allowed.length) candidates = allowed;
    let best = candidates[0];
    for (const d of candidates) if ((loads[d] || 0) < (loads[best] || 0)) best = d;
    out[t.uid] = best;
    loads[best] = (loads[best] || 0) + estOf(t.uid);
  }
  return out;
}

/**
 * Weeks with `min` or more summatives: [{ start: 'YYYY-MM-DD', items }], earliest first.
 * weekStartOf maps a date to the first day of its week.
 */
export function crunchWeeks(items, weekStartOf, min = 2) {
  const by = {};
  for (const e of items) (by[weekStartOf(e.date)] ||= []).push(e);
  return Object.keys(by).sort().filter((w) => by[w].length >= min).map((w) => ({ start: w, items: by[w] }));
}

/**
 * Revision sessions for upcoming summatives, as plannable items with uid "prep:<summative uid>".
 * Due the day before the summative, or three days before when it falls in a crunch week,
 * moved back to the nearest day that avoid() allows (school days).
 */
export function prepTasks(summatives, { today, crunchStarts = new Set(), weekStartOf, avoid = () => false, title = (e) => e.title }) {
  return summatives
    .filter((e) => e.date > today)
    .map((e) => {
      const lead = crunchStarts.has(weekStartOf(e.date)) ? 3 : 1;
      let date = addDays(e.date, -lead);
      // Land on a school day (not a weekend or holiday) unless that would be in the past.
      for (let n = 0; n < 14 && avoid(date) && addDays(date, -1) >= today; n++) date = addDays(date, -1);
      if (date < today) date = today;
      return { uid: `prep:${e.uid}`, of: e.uid, kind: 'prep', type: 'Revision', title: `Revise: ${title(e)}`, date, time: null, allDay: true, endDate: date, endTime: null, tz: null, classes: e.classes, link: e.link, links: [], description: '' };
    });
}
