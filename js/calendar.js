// Calendar: month grid (holidays as continuous bars, assessments stand out) and a week view with time slots.
import { state, classColor, classInfo, isDone, kindOf } from './store.js';
import { esc, today, addDays, ymd, fmtDate, fmtTime, parseYmd, displayTitle } from './util.js';
import { dueClock, isAssessment } from './urgency.js';
import { taskRow, eventRow, isSummative } from './components.js';
import { actions, rerender } from './ui.js';
import { dayTimetable } from './timetable.js';
import { busyWeeks, weekStartOf } from './planner.js';

const now = new Date();
const cal = { y: now.getFullYear(), m: now.getMonth(), sel: today(), view: 'month', week: today() };

actions['cal-prev'] = () => {
  if (cal.view === 'week') cal.week = addDays(cal.week, -7);
  else if (--cal.m < 0) { cal.m = 11; cal.y--; }
  rerender();
};
actions['cal-next'] = () => {
  if (cal.view === 'week') cal.week = addDays(cal.week, 7);
  else if (++cal.m > 11) { cal.m = 0; cal.y++; }
  rerender();
};
actions['cal-today'] = () => {
  const d = new Date();
  cal.y = d.getFullYear(); cal.m = d.getMonth(); cal.sel = today(); cal.week = today();
  rerender();
};
actions['cal-select'] = (el) => { cal.sel = el.dataset.date; cal.week = el.dataset.date; rerender(); };
actions['cal-view'] = (el) => {
  cal.view = el.dataset.v;
  if (cal.view === 'week') cal.week = cal.sel;
  else { const d = parseYmd(cal.week); cal.y = d.getFullYear(); cal.m = d.getMonth(); }
  rerender();
};

const isOff = (e) => e.type === 'Holidays and vacations';
const isBand = (e) => e.kind === 'event' && (isOff(e) || e.endDate > e.date);
const visible = (e) => !(state.settings.hideClosures && isOff(e));

function eventsByDay() {
  const map = {};
  for (const e of state.events) {
    if (!visible(e)) continue;
    let d = e.date;
    for (let n = 0; n < 60 && d <= e.endDate; n++, d = addDays(d, 1)) (map[d] ||= []).push(e);
  }
  return map;
}

function chip(e) {
  if (e.kind !== 'task') return `<span class="cal-chip ev" style="--c:var(--accent)">${esc(displayTitle(e.title))}</span>`;
  const c = classColor(e.classes[0]);
  const cls = [isAssessment(e) ? (isSummative(e) ? 'strong' : 'formative') : '', isDone(e.uid) ? 'is-done' : '', kindOf(e) === 'material' ? 'mat' : ''].join(' ');
  return `<span class="cal-chip ${cls}" style="--c:${c}">${isAssessment(e) ? '★ ' : ''}${esc(displayTitle(e.title))}</span>`;
}

function monthView(map) {
  const ws = Number(state.settings.weekStart);
  const first = new Date(cal.y, cal.m, 1);
  const offset = (first.getDay() - ws + 7) % 7;
  const start = new Date(cal.y, cal.m, 1 - offset);
  const t = today();
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const heads = Array.from({ length: 7 }, (_, i) => `<div class="cal-dow">${names[(ws + i) % 7]}</div>`).join('');
  let cells = '';
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const key = ymd(d);
    const evs = map[key] || [];
    const bands = evs.filter(isBand).map((e) => {
      const first = key === e.date || i % 7 === 0;
      return `<span class="cal-band ${key === e.date ? 'b-start' : ''} ${key === e.endDate ? 'b-end' : ''} ${isOff(e) ? 'off' : ''}" title="${esc(e.title)}">${first ? esc(displayTitle(e.title)) : '&nbsp;'}</span>`;
    }).join('');
    const rest = evs.filter((e) => !isBand(e)).sort((a, b) => Number(isAssessment(b)) - Number(isAssessment(a)));
    const chips = rest.slice(0, 3).map(chip).join('');
    cells += `<button class="cal-cell ${d.getMonth() !== cal.m ? 'other' : ''} ${key === t ? 'today' : ''} ${key === cal.sel ? 'selected' : ''} ${evs.some(isOff) ? 'is-off' : ''}" data-action="cal-select" data-date="${key}" aria-label="${fmtDate(key)}, ${evs.length} events">
      <span class="cal-num">${d.getDate()}</span>${bands}<span class="cal-chips">${chips}</span>${rest.length > 3 ? `<span class="cal-more">+${rest.length - 3}</span>` : ''}</button>`;
  }
  return `<div class="cal">${heads}${cells}</div>`;
}

const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

// Side-by-side lanes for overlapping items in one day column.
function lanes(items) {
  const ends = [];
  for (const it of items.sort((a, b) => a.s - b.s || b.e - a.e)) {
    let lane = ends.findIndex((end) => end <= it.s);
    if (lane < 0) { lane = ends.length; ends.push(0); }
    ends[lane] = it.e;
    it.lane = lane;
  }
  items.forEach((it) => { it.of = ends.length; });
  return items;
}

function weekView(map) {
  const start = weekStartOf(cal.week);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const t = today();
  const timed = {};
  const allDay = {};
  let lo = 8 * 60;
  let hi = 17 * 60;
  for (const d of days) {
    const evs = map[d] || [];
    allDay[d] = evs.filter((e) => e.allDay || isBand(e));
    const items = evs.filter((e) => !e.allDay && !isBand(e)).map((e) => {
      const s = toMin(dueClock(e) || e.time);
      const end = e.endTime && e.endDate === e.date ? Math.max(toMin(e.endTime), s + 20) : s + 30;
      return { ev: e, s, e: end };
    });
    const tt = dayTimetable(d).lessons.map((l) => ({ ev: l, s: toMin(l.start), e: toMin(l.end), kind: 'lesson' }));
    for (const it of [...items, ...tt]) { lo = Math.min(lo, it.s); hi = Math.max(hi, it.e); }
    timed[d] = { items: lanes(items), lessons: tt };
  }
  lo = Math.floor(lo / 60) * 60;
  hi = Math.ceil(hi / 60) * 60;
  const PX = 1.1;
  const hours = [];
  for (let m = lo; m <= hi; m += 60) hours.push(m);
  const busy = busyWeeks().find((w) => w.start === start);
  const col = (d) => {
    const { items, lessons } = timed[d];
    const lessonHtml = lessons.map((l) => `<div class="wk-lesson" style="top:${(l.s - lo) * PX}px;height:${(l.e - l.s) * PX}px;--c:${l.ev.cls ? classColor(l.ev.cls) : 'var(--muted)'}" title="${esc(l.ev.name)} ${l.ev.start}–${l.ev.end}"><span>${esc(l.ev.cls ? classInfo(l.ev.cls).name : l.ev.name)}</span></div>`).join('');
    const itemHtml = items.map((it) => {
      const e = it.ev;
      const c = e.kind === 'task' ? classColor(e.classes[0]) : 'var(--accent)';
      const cls = [e.kind === 'task' && isAssessment(e) ? 'strong' : '', e.kind === 'task' && isDone(e.uid) ? 'is-done' : '', e.kind === 'task' && kindOf(e) === 'material' ? 'mat' : ''].join(' ');
      const w = 100 / it.of;
      return `<button class="wk-item ${cls}" data-action="open-task" data-uid="${esc(e.uid)}" style="top:${(it.s - lo) * PX}px;height:${Math.max(22, (it.e - it.s) * PX)}px;left:calc(${it.lane * w}% + 2px);width:calc(${w}% - 4px);--c:${c}">
        <b>${esc(fmtTime(dueClock(e) || e.time, state.settings.time24))}</b> ${esc(displayTitle(e.title))}</button>`;
    }).join('');
    return `<div class="wk-col ${d === t ? 'today' : ''}" style="height:${(hi - lo) * PX}px">${hours.map((m) => `<div class="wk-line" style="top:${(m - lo) * PX}px"></div>`).join('')}${lessonHtml}${itemHtml}</div>`;
  };
  return `
  ${busy ? `<p class="note">Busy week: ${busy.items.length} summatives (${busy.items.map((e) => esc(displayTitle(e.title))).join(', ')}).</p>` : ''}
  <div class="wk-scroll"><div class="wk">
    <div class="wk-corner"></div>
    ${days.map((d) => `<button class="wk-head ${d === t ? 'today' : ''} ${d === cal.sel ? 'selected' : ''}" data-action="cal-select" data-date="${d}"><span>${fmtDate(d, { weekday: 'short' })}</span><b>${parseYmd(d).getDate()}</b></button>`).join('')}
    <div class="wk-corner small muted">all day</div>
    ${days.map((d) => `<div class="wk-allday">${allDay[d].map((e) => (e.kind === 'task' ? `<button class="cal-chip ${isAssessment(e) ? 'strong' : ''}" data-action="open-task" data-uid="${esc(e.uid)}" style="--c:${classColor(e.classes[0])}">${esc(displayTitle(e.title))}</button>` : `<button class="cal-band b-start b-end ${isOff(e) ? 'off' : ''}" data-action="open-task" data-uid="${esc(e.uid)}">${esc(displayTitle(e.title))}</button>`)).join('')}</div>`).join('')}
    <div class="wk-times" style="height:${(hi - lo) * PX}px">${hours.map((m) => `<span style="top:${(m - lo) * PX}px">${fmtTime(`${String(m / 60).padStart(2, '0')}:00`, state.settings.time24)}</span>`).join('')}</div>
    ${days.map(col).join('')}
  </div></div>
  <p class="muted small">Toddle tasks sit at their due time. ${dayTimetable(days[0]).lessons.length || days.some((d) => dayTimetable(d).lessons.length) ? 'Shaded blocks are your lessons from Schedule.' : 'Link your timetable in Settings to see your lessons here too.'}</p>`;
}

export function calendarPage() {
  const map = eventsByDay();
  const sel = (map[cal.sel] || []).slice().sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  const title = cal.view === 'week'
    ? `${fmtDate(weekStartOf(cal.week), { day: 'numeric', month: 'short' })} – ${fmtDate(addDays(weekStartOf(cal.week), 6), { day: 'numeric', month: 'short', year: 'numeric' })}`
    : new Date(cal.y, cal.m, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const views = [['month', 'Month'], ['week', 'Week']].map(([k, l]) => `<button class="seg-btn ${cal.view === k ? 'on' : ''}" data-action="cal-view" data-v="${k}" aria-pressed="${cal.view === k}">${l}</button>`).join('');
  return `
  <div class="page-head"><h1>Calendar</h1>
    <div class="row"><div class="seg" role="group" aria-label="View">${views}</div>
      <button class="btn small" data-action="cal-prev" aria-label="Previous">‹</button><strong class="cal-title">${title}</strong><button class="btn small" data-action="cal-next" aria-label="Next">›</button><button class="btn small" data-action="cal-today">Today</button></div></div>
  ${state.events.length ? '' : '<p class="muted">Import your Toddle calendar in Settings to see assignments here.</p>'}
  ${cal.view === 'week' ? weekView(map) : monthView(map)}
  <p class="cal-key muted small"><span class="cal-chip strong" style="--c:var(--accent)">★ Assessment</span><span class="cal-chip" style="--c:var(--accent)">Homework / task</span><span class="cal-chip mat" style="--c:var(--accent)">Class material</span><span class="cal-band b-start b-end off">Day off</span></p>
  <section class="card"><h2>${fmtDate(cal.sel, { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
    ${sel.length ? `<div class="list">${sel.map((e) => (e.kind === 'task' ? taskRow(e) : eventRow(e))).join('')}</div>` : '<p class="muted">Nothing on this day.</p>'}</section>`;
}
