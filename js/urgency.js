// Pure deadline logic: when something is due, whether it is overdue, and what deserves a warning.
export const HOUR = 3600e3;
export const DAY = 24 * HOUR;

// How far a time zone is ahead of UTC at a given instant, in ms.
function zoneOffsetMs(ms, tz) {
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric',
  });
  const p = Object.fromEntries(f.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(ms / 1000) * 1000;
}

// A wall-clock time in a given zone (e.g. 10:15 in Europe/Zurich) as an instant. Falls back to the device's zone.
export function wallToMs(date, time, tz) {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  if (tz) {
    try {
      const asUtc = Date.UTC(y, m - 1, d, hh, mm);
      const guess = asUtc - zoneOffsetMs(asUtc, tz);
      return asUtc - zoneOffsetMs(guess, tz); // second pass corrects across a daylight-saving change
    } catch (e) { /* unknown zone: use the device zone */ }
  }
  return new Date(y, m - 1, d, hh, mm).getTime();
}

// Items without a time are due at the end of their day.
export const dueMs = (e) => wallToMs(e.date, e.time || '23:59', e.tz);
export const isOverdue = (e, now = Date.now()) => dueMs(e) < now;
const isAssessment = (e) => /Assessment/.test(e.type);

/**
 * Splits open work into what is overdue and what is due soon.
 * soon = due within warnHours, or an assessment due within assessDays.
 * Overdue by more than recentDays is only counted (older), not listed.
 */
export function classify(items, { now = Date.now(), warnHours = 24, assessDays = 3, isDone = () => false, isMuted = () => false, recentDays = 14 } = {}) {
  const overdue = [];
  const soon = [];
  let older = 0;
  for (const e of items) {
    if (isDone(e.uid) || isMuted(e.uid)) continue;
    const due = dueMs(e);
    const diff = due - now;
    if (diff < 0) {
      if (-diff > recentDays * DAY) older++;
      else overdue.push({ e, due, late: -diff });
    } else if (diff <= warnHours * HOUR || (isAssessment(e) && diff <= assessDays * DAY)) {
      soon.push({ e, due, left: diff, urgent: diff <= 3 * HOUR });
    }
  }
  // Assessments first, then the most recently missed.
  overdue.sort((a, b) => Number(isAssessment(b.e)) - Number(isAssessment(a.e)) || a.late - b.late);
  soon.sort((a, b) => a.due - b.due);
  return { overdue, soon, older };
}

export function humanSpan(ms) {
  const min = Math.round(Math.abs(ms) / 60000);
  if (min < 1) return 'less than a minute';
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  if (h < 36) return `${h} h`;
  return `${Math.round(h / 24)} days`;
}
