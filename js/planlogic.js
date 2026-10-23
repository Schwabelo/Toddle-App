// Pure planner logic: spread unplanned assignments over the days before their deadlines.
import { addDays, parseYmd } from './util.js';

export const isWeekend = (d) => [0, 6].includes(parseYmd(d).getDay());

/**
 * tasks:  open, unplanned assignments ({ uid, date, time })
 * load:   minutes already planned per day { 'YYYY-MM-DD': minutes }
 * Returns { uid: 'YYYY-MM-DD' }, or null when the week is already over.
 * Earliest deadlines go first; each task takes the lightest allowed day on or before its deadline
 * (earliest day wins a tie). Overdue work is spread over the whole week, starting from the first day still available.
 */
export function autoPlan({ tasks, load, today, weekStart, weekEnd, weekends, estOf }) {
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
    const allowed = weekends ? candidates : candidates.filter((d) => !isWeekend(d));
    if (allowed.length) candidates = allowed;
    let best = candidates[0];
    for (const d of candidates) if ((loads[d] || 0) < (loads[best] || 0)) best = d;
    out[t.uid] = best;
    loads[best] = (loads[best] || 0) + estOf(t.uid);
  }
  return out;
}
