// Weekly planner: put assignments on days, watch the load per day, and auto-spread what's left.
import { state, save, todos, isDone, classInfo, closures, isCatchup } from './store.js';
import { esc, today, addDays, fmtDate, fmtTime, parseYmd, displayTitle } from './util.js';
import { isOverdue, dueClock } from './urgency.js';
import { actions, changes, rerender, toast } from './ui.js';
import { emptyState, isSummative } from './components.js';
import { autoPlan, isWeekend, crunchWeeks, prepTasks } from './planlogic.js';
import { focusOn } from './timer.js';
import { ask } from './dialog.js';
import { dayTimetable } from './timetable.js';

let anchor = null; // any date inside the week being shown

// Used by alerts to open the planner on the week of a given day.
export function showWeekOf(date) {
  anchor = date;
}

export const weekStartOf = (d) => addDays(d, -((parseYmd(d).getDay() - Number(state.settings.weekStart) + 7) % 7));
function weekOf() {
  anchor ||= today();
  const start = weekStartOf(anchor);
  return { start, end: addDays(start, 6), days: Array.from({ length: 7 }, (_, i) => addDays(start, i)) };
}

export const estOf = (uid) => state.est[uid] || (uid.startsWith('prep:') ? Number(state.settings.prepMin) || 45 : Number(state.settings.defaultEst) || 30);

// Open summatives, grouped into weeks that have two or more.
const openSummatives = () => todos().filter((e) => isSummative(e) && !isDone(e.uid));
export const busyWeeks = () => crunchWeeks(openSummatives(), weekStartOf, 2);

// Everything the planner can place: real to-dos plus revision sessions before summatives.
function plannable() {
  const items = todos();
  if (!state.settings.prepSessions) return items;
  const crunchStarts = new Set(busyWeeks().map((w) => w.start));
  const off = closures();
  const avoid = state.settings.planWeekends ? () => false : (d) => isWeekend(d) || Boolean(off[d]);
  return items.concat(prepTasks(openSummatives(), { today: today(), crunchStarts, weekStartOf, avoid, title: (e) => displayTitle(e.title) }));
}

function setPlan(uid, date) {
  if (date) state.plan[uid] = date;
  else delete state.plan[uid];
  save();
}

function loadByDay(days) {
  const load = {};
  for (const e of plannable()) {
    const d = state.plan[e.uid];
    if (d && days.includes(d) && !isDone(e.uid)) load[d] = (load[d] || 0) + estOf(e.uid);
  }
  return load;
}

// Open, unplanned work due by the end of this week (plus anything recently overdue).
function trayTasks(w) {
  const oldest = addDays(today(), -14);
  return plannable().filter((e) => !isDone(e.uid) && !state.plan[e.uid] && e.date <= w.end && e.date >= oldest && !isCatchup(e));
}

export function todaysPlan() {
  const items = plannable().filter((e) => state.plan[e.uid] === today() && !isDone(e.uid));
  return { items, minutes: items.reduce((a, e) => a + estOf(e.uid), 0) };
}

// ---- views ----
function planCard(e, w) {
  const id = esc(e.uid);
  const done = isDone(e.uid);
  const planned = state.plan[e.uid] || '';
  const est = state.est[e.uid];
  const cls = e.classes[0] || '';
  const c = classInfo(cls);
  const prep = e.kind === 'prep';
  const late = !done && !prep && isOverdue(e);
  const after = planned && planned > e.date && !done && !late;
  const options = ['<option value="">Not planned</option>']
    .concat(w.days.map((d) => `<option value="${d}" ${d === planned ? 'selected' : ''}>${fmtDate(d)}</option>`))
    .join('');
  return `
  <div class="pcard ${done ? 'is-done' : ''} ${prep ? 'prep' : ''}" draggable="true" data-drag="${id}" style="--c:${c.color}">
    <details class="p-main" data-keep="p-${id}">
      <summary>
        <span class="p-title">${esc(displayTitle(e.title))}</span>
        <span class="p-meta">
          <button class="check" data-action="toggle" data-uid="${id}" aria-pressed="${done}" aria-label="${done ? 'Mark as not done' : 'Mark as done'}">${done ? '✓' : ''}</button>
          <span class="p-cls">${esc(c.name)}</span>
          <span class="p-min">${est ? est : '~' + estOf(e.uid)} min</span>
        </span>
        ${!planned && !late ? `<span class="p-due">${prep ? 'Before' : 'Due'} ${esc(fmtDate(e.date, { weekday: 'short', day: 'numeric' }))}</span>` : ''}${late ? '<span class="p-flag">overdue</span>' : ''}${after ? `<span class="p-flag">${prep ? 'late for revision' : 'after due date'}</span>` : ''}
      </summary>
      <div class="p-edit">
        <div class="muted small">${prep ? 'Revise by' : 'Due'} ${esc(fmtDate(e.date))}${e.allDay ? '' : ' · ' + esc(fmtTime(dueClock(e), state.settings.time24))}</div>
        <label class="field">Day <select data-change="plan-day" data-uid="${id}">${options}</select></label>
        <label class="field">Minutes <input type="number" min="5" max="480" step="5" data-change="plan-est" data-uid="${id}" value="${est || ''}" placeholder="${estOf(e.uid)}"></label>
        <div class="row"><button class="btn small" data-action="plan-focus" data-cls="${esc(cls)}">Start timer</button><button class="btn small" data-action="open-task" data-uid="${esc(prep ? e.of : e.uid)}">Details</button></div>
      </div>
    </details>
  </div>`;
}

const dueMark = (e) =>
  `<div class="due-mark"><b>Due</b> ${e.allDay ? '' : esc(fmtTime(dueClock(e), state.settings.time24)) + ' · '}${esc(displayTitle(e.title))}</div>`;

function lessonsLine(d) {
  const { lessons, free } = dayTimetable(d);
  if (!lessons.length) return '';
  const names = lessons.map((l) => `<span class="lesson-pill" style="--c:${l.cls ? classInfo(l.cls).color : 'var(--muted)'}" title="${esc(l.start)}–${esc(l.end)}">${esc(l.cls ? classInfo(l.cls).name : l.name)}</span>`).join('');
  return `<div class="p-lessons">${names}</div>${free.length ? `<div class="muted small">Free: ${free.map((p) => `P${p.num} ${esc(fmtTime(p.start, state.settings.time24))}`).join(', ')}</div>` : ''}`;
}

export function plannerPage() {
  if (!state.events.length) {
    return '<h1>Planner</h1>' + emptyState('📥', 'Import your Toddle calendar first', 'The planner works with your assignments.', '<a class="btn primary" href="#/settings">Go to import</a>');
  }
  const w = weekOf();
  const t = today();
  const limit = Number(state.settings.dailyLimit) || 90;
  const load = loadByDay(w.days);
  const tray = trayTasks(w);

  const off = closures();
  const plannedBy = {};
  const dueBy = {};
  for (const e of plannable()) {
    const p = state.plan[e.uid];
    if (p && p >= w.start && p <= w.end) (plannedBy[p] ||= []).push(e);
    // Deadline reminders only for work that is planned on another day; unplanned work is already in the tray.
    if (e.kind !== 'prep' && p && p !== e.date && !isDone(e.uid) && e.date >= w.start && e.date <= w.end) (dueBy[e.date] ||= []).push(e);
  }
  const busy = busyWeeks().find((x) => x.start === w.start);

  const columns = w.days.map((d) => {
    const mins = load[d] || 0;
    const over = mins > limit;
    const planned = plannedBy[d] || [];
    const due = dueBy[d] || [];
    return `
    <div class="pday ${d === t ? 'today' : ''} ${isWeekend(d) || off[d] ? 'weekend' : ''}" data-drop="${d}">
      <div class="pday-head"><strong>${fmtDate(d, { weekday: 'short', day: 'numeric' })}</strong><span class="small ${over ? 'over' : 'muted'}">${mins} / ${limit} min</span></div>
      <div class="bar"><span style="width:${Math.min(100, (100 * mins) / limit)}%;background:${over ? 'var(--warn)' : 'var(--accent)'}"></span></div>
      ${off[d] ? `<div class="p-off">${esc(off[d])}</div>` : lessonsLine(d)}
      ${due.map(dueMark).join('')}
      ${planned.map((e) => planCard(e, w)).join('')}
      ${planned.length || due.length ? '' : '<p class="muted small">Nothing planned</p>'}
    </div>`;
  }).join('');

  const range = `${fmtDate(w.start, { day: 'numeric', month: 'short' })} – ${fmtDate(w.end, { day: 'numeric', month: 'short', year: 'numeric' })}`;
  return `
  <div class="page-head"><div><h1>Planner</h1><p class="muted">${range}</p></div>
    <div class="row"><button class="btn small" data-action="plan-prev" aria-label="Previous week">‹</button><button class="btn small" data-action="plan-today">This week</button><button class="btn small" data-action="plan-next" aria-label="Next week">›</button></div></div>
  ${busy ? `<p class="note">Busy week: ${busy.items.length} summatives (${busy.items.map((e) => esc(displayTitle(e.title))).join(', ')}).${state.settings.prepSessions ? ' Their revision sessions are due 3 days early.' : ''}</p>` : ''}
  <section class="card" data-drop="">
    <div class="sec-head"><h2>To plan <span class="count">${tray.length}</span></h2>
      <div class="row"><button class="btn small" data-action="plan-clear">Clear week</button><button class="btn small primary" data-action="plan-auto">Auto-plan</button></div></div>
    ${tray.length ? `<div class="tray">${tray.map((e) => planCard(e, w)).join('')}</div>` : '<p class="muted">Everything due this week is planned.</p>'}
    <p class="muted small">Drag a card onto a day, or open it and pick a day. Auto-plan spreads the work before each deadline, up to ${limit} min a day${state.settings.planWeekends ? '' : ', skipping weekends and school holidays'}. ${state.settings.prepSessions ? 'Summatives get a revision session (✎). ' : ''}Limits are in Settings.</p>
  </section>
  <div class="pweek" style="--cols:${w.days.map((d) => (isWeekend(d) && !state.settings.planWeekends ? 'minmax(0,.8fr)' : 'minmax(0,1.3fr)')).join(' ')}">${columns}</div>`;
}

// ---- actions ----
actions['plan-prev'] = () => { anchor = addDays(weekOf().start, -7); rerender(); };
actions['plan-next'] = () => { anchor = addDays(weekOf().start, 7); rerender(); };
actions['plan-today'] = () => { anchor = today(); rerender(); };

actions['plan-auto'] = () => {
  const w = weekOf();
  const open = trayTasks(w);
  if (!open.length) return toast('Nothing left to plan this week.');
  const plan = autoPlan({
    tasks: open,
    load: loadByDay(w.days),
    today: today(),
    weekStart: w.start,
    weekEnd: w.end,
    weekends: Boolean(state.settings.planWeekends),
    blocked: new Set(Object.keys(closures())),
    estOf,
  });
  if (!plan) return toast('That week is already over. Pick this week or a later one.');
  Object.entries(plan).forEach(([uid, d]) => { state.plan[uid] = d; });
  save();
  const over = Object.values(loadByDay(w.days)).filter((m) => m > (Number(state.settings.dailyLimit) || 90)).length;
  toast(`Planned ${Object.keys(plan).length} items${over ? `. ${over} day${over > 1 ? 's are' : ' is'} over your daily limit` : ''}`);
  rerender();
};

actions['plan-clear'] = async () => {
  const w = weekOf();
  const mine = Object.entries(state.plan).filter(([uid, d]) => d >= w.start && d <= w.end && !isDone(uid));
  if (!mine.length) return toast('Nothing planned this week.');
  if (!(await ask(`Remove the plan for ${mine.length} item${mine.length > 1 ? 's' : ''} this week?`, { ok: 'Clear week' }))) return;
  mine.forEach(([uid]) => delete state.plan[uid]);
  save();
  rerender();
};

actions['plan-focus'] = (el) => {
  focusOn(el.dataset.cls);
  location.hash = '#/timer';
};

changes['plan-day'] = (el) => {
  setPlan(el.dataset.uid, el.value);
  rerender();
};
changes['plan-est'] = (el) => {
  const n = Math.round(Number(el.value));
  if (n >= 1) state.est[el.dataset.uid] = Math.min(480, n);
  else delete state.est[el.dataset.uid];
  save();
  rerender();
};

// ---- drag and drop (a select on each card covers touch screens) ----
let dragUid = null;
const zoneOf = (e) => (e.target instanceof Element ? e.target.closest('[data-drop]') : null);

document.addEventListener('dragstart', (e) => {
  const card = e.target instanceof Element ? e.target.closest('[data-drag]') : null;
  if (!card) return;
  dragUid = card.dataset.drag;
  e.dataTransfer.setData('text/plain', dragUid);
  e.dataTransfer.effectAllowed = 'move';
  card.classList.add('dragging');
});
document.addEventListener('dragend', () => {
  dragUid = null;
  document.querySelectorAll('.dragging, .drop-on').forEach((el) => el.classList.remove('dragging', 'drop-on'));
});
document.addEventListener('dragover', (e) => {
  const zone = zoneOf(e);
  if (!zone || !dragUid) return;
  e.preventDefault();
  zone.classList.add('drop-on');
});
document.addEventListener('dragleave', (e) => {
  const zone = zoneOf(e);
  if (zone && !zone.contains(e.relatedTarget)) zone.classList.remove('drop-on');
});
document.addEventListener('drop', (e) => {
  const zone = zoneOf(e);
  if (!zone || !dragUid) return;
  e.preventDefault();
  setPlan(dragUid, zone.dataset.drop);
  dragUid = null;
  rerender();
});
