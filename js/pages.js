// Page views: Start, Classes, Class, Progress, Schedule, Settings.
import { state, save, classNames, classInfo, classStats, classColor, classTeachers, tasks, todos, todosFor, tasksFor, isDone, kindOf, toggleDone, studyMinutesOn, resetAll, replaceWith, SCHEDULER_KEY } from './store.js';
import { esc, today, addDays, diffDays, fmtDate, relDay, parseYmd, download, displayTitle } from './util.js';
import { taskRow, emptyState, bar, criteriaChips, subjectIcon, isSummative } from './components.js';
import { dueCardCount } from './cards.js';
import { todaysPlan, weekStartOf, busyWeeks } from './planner.js';
import { needsAttentionCard, syncLineHtml, currentAlerts } from './alerts.js';
import { isOverdue, dueMs, dueConfig, isAssessment } from './urgency.js';
import { criteriaOf, topicGroups, PALETTE } from './enrich.js';
import { actions, changes, inputs, rerender, toast } from './ui.js';
import { ask } from './dialog.js';
import { syncFromFeed, importText, prepareCatchup, getProxy, syncStatus } from './sync.js';
import { syncDurations } from './timer.js';
import { catchupCard } from './todo.js';
import { schedulerData, linkMap, timetableCycle, nextLessonOf } from './timetable.js';

const greeting = () => {
  const h = new Date().getHours();
  return h < 5 ? 'Still up' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
};

export const importCta = () =>
  emptyState('📥', 'Import your Toddle calendar', 'Add your Toddle calendar link or file and every assignment gets sorted into its class.', '<a class="btn primary" href="#/settings">Go to import</a>');

const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
const dayName = (d, t = today()) => (d === t ? 'Today' : diffDays(d, t) === 1 ? 'Tomorrow' : fmtDate(d, { weekday: 'long', day: 'numeric', month: 'short' }));

// ================= START =================
function nextAssessmentCard(open) {
  const list = open.filter((e) => isAssessment(e) && !isOverdue(e)).sort((a, b) => dueMs(a) - dueMs(b));
  if (!list.length) return '<section class="card"><h2>Assessments</h2><p class="muted">No assessments coming up.</p></section>';
  const [e, ...rest] = list;
  const c = classInfo(e.classes[0] || '');
  const days = diffDays(e.date, today());
  return `<section class="card hero" style="--c:${c.color}">
    <div class="hero-label">Next assessment</div>
    <button class="hero-title task-open" data-action="open-task" data-uid="${esc(e.uid)}">${esc(displayTitle(e.title))}</button>
    <div class="task-meta"><span class="class-label"><i class="dot" style="--c:${c.color}"></i>${esc(c.name)}</span>${criteriaChips(e)}</div>
    <div class="hero-count"><b>${days <= 0 ? 'Today' : days === 1 ? 'Tomorrow' : days}</b>${days > 1 ? '<span>days to go</span>' : ''}<span class="muted">${esc(fmtDate(e.date, { weekday: 'long', day: 'numeric', month: 'long' }))}</span></div>
    ${rest.length ? `<div class="hero-rest">${rest.slice(0, 3).map((x) => `<button class="mini-row task-open" data-action="open-task" data-uid="${esc(x.uid)}"><span><span class="mini-title">${esc(displayTitle(x.title))}</span><span class="muted small">${esc(classInfo(x.classes[0] || '').name)}</span></span><span class="mini-date">${fmtDate(x.date)}<br>${esc(relDay(x.date))}</span></button>`).join('')}</div>` : ''}
  </section>`;
}

function busyWeeksCard() {
  const weeks = busyWeeks().filter((w) => w.start >= weekStartOf(today())).slice(0, 2);
  if (!weeks.length) return '';
  return `<section class="card crunch"><h2>Busy weeks ahead</h2>${weeks.map((w) => `
    <div class="crunch-row"><strong>Week of ${fmtDate(w.start, { day: 'numeric', month: 'short' })}</strong> · ${plural(w.items.length, 'summative')}
      <div class="muted small">${w.items.map((e) => `${esc(displayTitle(e.title))} (${esc(classInfo(e.classes[0] || '').name)}, ${fmtDate(e.date, { weekday: 'short' })})`).join(' · ')}</div></div>`).join('')}
    <p class="muted small">${state.settings.prepSessions ? 'The planner adds revision sessions a few days earlier for these.' : ''} <a href="#/planner">Open planner</a></p></section>`;
}

function atSchoolCard() {
  const t = today();
  const until = addDays(t, 21);
  const events = state.events.filter((e) => e.kind === 'event' && e.endDate >= t && e.date <= until && e.type !== 'Holidays and vacations');
  const off = state.events.find((e) => e.type === 'Holidays and vacations' && e.endDate >= t);
  if (!events.length && !off) return '';
  const row = (e, label) => `<div class="mini-row"><span><span class="mini-title">${esc(displayTitle(e.title))}</span><span class="muted small">${esc(label || e.type)}</span></span><span class="mini-date">${e.date <= t ? 'Now' : fmtDate(e.date)}${e.endDate !== e.date ? ` – ${fmtDate(e.endDate)}` : ''}<br>${e.date > t ? esc(relDay(e.date)) : ''}</span></div>`;
  return `<section class="card"><h2>At school</h2>${events.map((e) => row(e)).join('')}${off ? row(off, 'Next time off') : ''}</section>`;
}

export function startPage() {
  const t = today();
  const name = state.settings.name ? `, ${esc(state.settings.name)}` : '';
  const cards = dueCardCount();
  const sync = syncLineHtml();
  const head = `<div class="page-head"><div><h1>${greeting()}${name}</h1><p class="muted">${fmtDate(t, { weekday: 'long', day: 'numeric', month: 'long' })}${sync ? ' · ' + sync : ''}</p></div>
    <div class="row"><a class="btn primary" href="#/timer">Start focus timer</a><a class="btn" href="#/flashcards">Flashcards${cards ? ` · ${cards} due` : ''}</a></div></div>`;
  if (!state.events.length) return head + importCta();

  const open = todos().filter((e) => !isDone(e.uid));
  const a = currentAlerts();
  const upcoming = open.filter((e) => !isOverdue(e)).sort((x, y) => dueMs(x) - dueMs(y));
  const week = upcoming.filter((e) => e.date <= addDays(t, 7));
  const dueToday = upcoming.filter((e) => e.date === t);
  const plan = todaysPlan();
  const todayItems = [...new Map([...dueToday, ...plan.items.filter((e) => e.kind !== 'prep')].map((e) => [e.uid, e])).values()];
  const preps = plan.items.filter((e) => e.kind === 'prep');

  const lede = [
    week.length ? `<b>${plural(week.length, 'thing')}</b> due in the next 7 days` : 'Nothing due in the next 7 days',
    a.overdue.length ? `<a href="#/todo/overdue">${a.overdue.length} overdue</a>` : '',
    upcoming[0] ? `next up: <button class="linkbtn" data-action="open-task" data-uid="${esc(upcoming[0].uid)}">${esc(displayTitle(upcoming[0].title))}</button>, ${esc(relDay(upcoming[0].date).toLowerCase())}` : '',
  ].filter(Boolean).join(' · ');

  const days = {};
  week.filter((e) => e.date !== t).forEach((e) => (days[e.date] ||= []).push(e));
  const dayBlocks = Object.keys(days).sort().map((d) => `<h3 class="day-h">${dayName(d)}</h3><div class="list">${days[d].map((e) => taskRow(e, { timeOnly: true })).join('')}</div>`).join('');

  return `${head}
  ${catchupCard()}
  <p class="lede">${lede}.</p>
  <div class="grid two">
    <div>
      ${needsAttentionCard()}
      <section class="card"><div class="sec-head"><h2>Today ${plan.minutes ? `<span class="count">${plan.minutes} min planned</span>` : ''}</h2><a class="btn small" href="#/planner">Planner</a></div>
        ${todayItems.length || preps.length
          ? `<div class="list">${todayItems.map((e) => taskRow(e, { timeOnly: e.date === t })).join('')}${preps.map((e) => `<div class="trow"><span class="mat-lead">✎</span><div class="task-main"><span class="task-title">${esc(e.title)}</span><span class="task-meta">Revision session</span></div></div>`).join('')}</div>`
          : '<p class="muted">Nothing due or planned today.</p>'}</section>
      <section class="card"><div class="sec-head"><h2>This week</h2><a class="btn small" href="#/todo">All to-dos</a></div>${dayBlocks || '<p class="muted">Nothing else due this week.</p>'}</section>
    </div>
    <div>
      ${nextAssessmentCard(open)}
      ${busyWeeksCard()}
      ${atSchoolCard()}
    </div>
  </div>`;
}

actions['toggle'] = (el) => {
  toggleDone(el.dataset.uid);
  rerender();
};

// ================= CLASSES =================
export function classesPage() {
  const names = classNames();
  if (!names.length) return '<h1>Classes</h1>' + importCta();
  const cards = names.map((c) => {
    const i = classInfo(c);
    const s = classStats(c);
    const pct = s.total ? Math.round((100 * s.done) / s.total) : 0;
    const teacher = classTeachers(c)[0];
    return `<a class="card class-card" href="#/class/${encodeURIComponent(c)}" style="--c:${i.color}">
      <div class="cc-banner"><span class="cc-icon" aria-hidden="true">${subjectIcon(c)}</span><span class="cc-code">${esc(i.code)}</span></div>
      <div class="cc-body">
        <h3>${esc(i.name)}</h3>
        ${teacher ? `<div class="muted small">${esc(teacher)}</div>` : ''}
        <div class="cc-nums"><span><strong>${s.open}</strong> to do</span>${s.overdue ? `<span class="late"><strong>${s.overdue}</strong> overdue</span>` : ''}<span class="muted">${pct}% done</span></div>
        ${bar([{ v: pct, c: i.color, t: 'done' }])}
        <div class="muted small cc-next">${s.next ? `Next: ${esc(displayTitle(s.next.title))} · ${fmtDate(s.next.date)}` : 'Nothing upcoming'}</div>
      </div>
    </a>`;
  }).join('');
  return `<div class="page-head"><h1>Classes</h1><span class="muted">${todos().length} to-dos in ${names.length} classes</span></div><div class="grid classes">${cards}</div>`;
}

let classFilter = 'open';
let typeFilter = '';
let search = '';
let groupBy = 'date';
let shownClass = '';

actions['class-filter'] = (el) => {
  classFilter = el.dataset.f;
  rerender();
};
actions['class-group'] = (el) => {
  groupBy = el.dataset.g;
  rerender();
};
changes['type-filter'] = (el) => {
  typeFilter = el.value;
  rerender();
};
// Only the list is redrawn while typing, so the search box keeps its focus and cursor.
inputs['search'] = (el) => {
  search = el.value;
  const box = document.getElementById('class-list');
  if (box) box.innerHTML = classListHtml(shownClass, '');
};
actions['class-mark-past'] = async (el) => {
  const past = todosFor(el.dataset.cls).filter((e) => isOverdue(e) && !isDone(e.uid));
  if (!(await ask(`Mark ${plural(past.length, 'overdue item')} in this class as done?`, { ok: 'Mark done' }))) return;
  past.forEach((e) => toggleDone(e.uid, 'bulk'));
  rerender();
};
actions['class-color'] = (el) => {
  state.classColors[el.dataset.cls] = el.dataset.color;
  save();
  rerender();
};

function criteriaStrip(name) {
  const list = tasksFor(name).filter((e) => isAssessment(e) && kindOf(e) === 'todo');
  const by = { A: [], B: [], C: [], D: [] };
  list.forEach((e) => criteriaOf(e.title).forEach((l) => by[l].push(e)));
  if (!Object.values(by).some((x) => x.length)) return '';
  const t = today();
  const box = (l) => {
    const items = by[l].sort((a, b) => a.date.localeCompare(b.date));
    const summ = items.filter(isSummative).length;
    const next = items.find((e) => e.date >= t);
    const last = [...items].reverse().find((e) => e.date < t);
    return `<div class="crit-box ${items.length ? '' : 'none'}"><span class="crit crit-${l}">${l}</span>
      <div><b>${items.length ? `${summ} summative${items.length - summ ? `, ${items.length - summ} formative` : ''}` : 'Not assessed yet'}</b>
      <div class="muted small">${next ? `Next: ${fmtDate(next.date)}` : last ? `Last: ${fmtDate(last.date)}` : ''}</div></div></div>`;
  };
  return `<section class="card"><h2>MYP criteria <span class="count">from task titles</span></h2><div class="crit-grid">${['A', 'B', 'C', 'D'].map(box).join('')}</div></section>`;
}

function filteredList(name) {
  const all = tasksFor(name);
  let list = all.filter((e) => {
    const k = kindOf(e);
    if (classFilter === 'material') return k === 'material';
    if (k === 'material') return classFilter === 'all';
    return classFilter === 'open' ? !isDone(e.uid) : classFilter === 'done' ? isDone(e.uid) : true;
  });
  if (typeFilter) list = list.filter((e) => e.type === typeFilter);
  if (search.trim()) {
    const q = search.trim().toLowerCase();
    list = list.filter((e) => (e.title + ' ' + e.description + ' ' + e.createdBy).toLowerCase().includes(q));
  }
  return list;
}

function classListHtml(name, focusUid) {
  const list = filteredList(name);
  if (!list.length) return '<p class="muted">Nothing matches these filters.</p>';
  const row = (e, rel) => taskRow(e, { showClass: false, showRel: rel, focus: e.uid === focusUid });
  const section = (title, arr, rel) => (arr.length ? `<h3 class="day-h">${esc(title)} <span class="count">${arr.length}</span></h3><div class="card flush"><div class="list">${arr.map((e) => row(e, rel)).join('')}</div></div>` : '');
  if (groupBy === 'topic') {
    return topicGroups(list, (e) => displayTitle(e.title)).map((g) => section(g.label, g.items.sort((a, b) => a.date.localeCompare(b.date)), true)).join('')
      + '<p class="muted small">Topics are a guess from words that appear in several titles.</p>';
  }
  const t = today();
  const late = (e) => !isDone(e.uid) && kindOf(e) === 'todo' && isOverdue(e);
  const overdue = list.filter(late).reverse();
  const upcoming = list.filter((e) => !late(e) && !(e.date < t && (isDone(e.uid) || kindOf(e) === 'material')));
  const past = list.filter((e) => e.date < t && (isDone(e.uid) || kindOf(e) === 'material')).reverse();
  return section('Overdue', overdue, true) + section('Upcoming', upcoming, true) + section('Earlier', past, false);
}

export function classPage(name, focusUid = '') {
  if (!classNames().includes(name)) return emptyState('🤔', 'Class not found', '<a href="#/classes">Back to classes</a>');
  if (focusUid) {
    // coming from an alert: make sure the filters cannot hide the task
    typeFilter = '';
    search = '';
    if (classFilter === 'done' || classFilter === 'material') classFilter = 'all';
  }
  if (shownClass !== name) groupBy = 'date';
  shownClass = name;
  const i = classInfo(name);
  const all = tasksFor(name);
  const types = [...new Set(all.map((e) => e.type))];
  const s = classStats(name);
  const teachers = classTeachers(name);
  const lesson = nextLessonOf(name);
  const materials = all.filter((e) => kindOf(e) === 'material').length;
  const chips = [['open', 'To do'], ['done', 'Done'], ['material', `Class material${materials ? ` · ${materials}` : ''}`], ['all', 'All']]
    .map(([k, l]) => `<button class="chip ${classFilter === k ? 'active' : ''}" data-action="class-filter" data-f="${k}">${l}</button>`).join('');
  const group = [['date', 'By date'], ['topic', 'By topic']]
    .map(([k, l]) => `<button class="seg-btn ${groupBy === k ? 'on' : ''}" data-action="class-group" data-g="${k}" aria-pressed="${groupBy === k}">${l}</button>`).join('');
  return `
  <a class="muted small back" href="#/classes">← All classes</a>
  <header class="class-hero" style="--c:${i.color}">
    <span class="cc-icon big" aria-hidden="true">${subjectIcon(name)}</span>
    <div class="grow">
      <h1>${esc(i.name)}</h1>
      <div class="muted">${esc(i.code)}${teachers.length ? ' · ' + esc(teachers.join(', ')) : ''}${lesson ? ` · Next lesson ${esc(lesson.label)}` : ''}</div>
      <div class="muted small">${s.done}/${s.total} done${s.overdue ? ` · <span class="late">${s.overdue} overdue</span>` : ''}</div>
    </div>
    <div class="row">
      ${s.overdue ? `<button class="btn small" data-action="class-mark-past" data-cls="${esc(name)}">Mark overdue as done</button>` : ''}
      <details class="more"><summary class="btn small">Colour</summary><div class="more-menu swatches">${PALETTE.map((c) => `<button class="swatch ${c === i.color ? 'active' : ''}" style="background:${c}" data-action="class-color" data-cls="${esc(name)}" data-color="${c}" aria-label="Colour ${c}"></button>`).join('')}</div></details>
    </div>
  </header>
  ${criteriaStrip(name)}
  <div class="filters">
    <div class="row">${chips}</div>
    <select data-change="type-filter" aria-label="Filter by type"><option value="">All types</option>${types.map((x) => `<option ${typeFilter === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>
    <input type="search" data-input="search" placeholder="Search…" value="${esc(search)}" aria-label="Search assignments">
    <div class="seg" role="group" aria-label="Group">${group}</div>
  </div>
  <div id="class-list">${classListHtml(name, focusUid)}</div>`;
}

// ================= PROGRESS =================
function criteriaMatrix() {
  const names = classNames();
  const rows = names.map((c) => {
    const counts = { A: 0, B: 0, C: 0, D: 0 };
    tasksFor(c).filter((e) => isAssessment(e) && kindOf(e) === 'todo').forEach((e) => criteriaOf(e.title).forEach((l) => counts[l]++));
    return [c, counts];
  }).filter(([, n]) => Object.values(n).some(Boolean));
  if (!rows.length) return '';
  return `<section class="card"><h2>MYP criteria assessed <span class="count">from task titles</span></h2>
    <table class="matrix"><thead><tr><th></th>${['A', 'B', 'C', 'D'].map((l) => `<th><span class="crit crit-${l}">${l}</span></th>`).join('')}</tr></thead>
    <tbody>${rows.map(([c, n]) => `<tr><th><a href="#/class/${encodeURIComponent(c)}"><i class="dot" style="--c:${classColor(c)}"></i>${esc(classInfo(c).name)}</a></th>${['A', 'B', 'C', 'D'].map((l) => `<td class="${n[l] ? '' : 'zero'}">${n[l] || '–'}</td>`).join('')}</tr>`).join('')}</tbody></table>
    <p class="muted small">Counts summative and formative tasks whose title names a criterion ("Crit B", "Criteria CD", "B, C, D …").</p></section>`;
}

export function progressPage() {
  if (!state.events.length) return '<h1>Progress</h1>' + importCta();
  const t = today();
  const now = Date.now();
  const all = todos();
  const dueNow = all.filter((e) => dueMs(e) <= now); // same rule as overdue everywhere else
  const doneAll = all.filter((e) => isDone(e.uid));
  const doneDue = dueNow.filter((e) => isDone(e.uid));
  const pct = dueNow.length ? Math.round((100 * doneDue.length) / dueNow.length) : 100;

  const rows = classNames().map((c) => {
    const i = classInfo(c);
    const list = todosFor(c);
    const n = list.length || 1;
    const d = list.filter((e) => isDone(e.uid)).length;
    const od = list.filter((e) => !isDone(e.uid) && isOverdue(e)).length;
    return `<div class="prog-row" style="--c:${i.color}"><div class="prog-name"><a href="#/class/${encodeURIComponent(c)}">${esc(i.name)}</a><span class="muted small">${d}/${list.length} done${od ? ` · <span class="late">${od} overdue</span>` : ''}</span></div>
      ${bar([{ v: (100 * d) / n, c: i.color, t: 'done' }, { v: (100 * od) / n, c: 'var(--bad)', t: 'overdue' }])}</div>`;
  }).join('');

  // study minutes, last 14 days
  const days = Array.from({ length: 14 }, (_, k) => addDays(t, k - 13));
  const mins = days.map(studyMinutesOn);
  const max = Math.max(30, ...mins);
  const chart = days.map((d, k) => `<div class="col" title="${fmtDate(d)}: ${mins[k]} min"><div class="col-bar" style="height:${(100 * mins[k]) / max}%"></div><span class="col-lab">${parseYmd(d).getDate()}</span></div>`).join('');

  const active = (d) => studyMinutesOn(d) > 0 || (state.reviews[d] || 0) > 0 || Object.values(state.done).includes(d);
  let streak = 0;
  for (let d = active(t) ? t : addDays(t, -1); active(d); d = addDays(d, -1)) streak++;
  const week = days.slice(7);
  const weekMin = week.reduce((a, d) => a + studyMinutesOn(d), 0);
  const weekCards = week.reduce((a, d) => a + (state.reviews[d] || 0), 0);
  const totalMin = state.sessions.reduce((a, s) => a + s.minutes, 0);

  const byClass = {};
  state.sessions.forEach((s) => (byClass[s.cls || ''] = (byClass[s.cls || ''] || 0) + s.minutes));
  const studyRows = Object.entries(byClass).sort((a, b) => b[1] - a[1]).map(([c, m]) => `<div class="mini-row" style="--c:${c ? classColor(c) : 'var(--accent)'}"><span class="mini-title">${c ? esc(classInfo(c).name) : 'General'}</span><span class="muted">${m} min</span></div>`).join('');

  return `
  <h1>Progress</h1>
  <div class="grid stats">
    <div class="card stat"><div class="stat-num">${pct}<small>%</small></div><div class="muted">of due work done</div></div>
    <div class="card stat"><div class="stat-num">${doneAll.length}<small>/${all.length}</small></div><div class="muted">to-dos done</div></div>
    <div class="card stat"><div class="stat-num">${streak}<small>d</small></div><div class="muted">day streak</div></div>
    <div class="card stat"><div class="stat-num">${Math.round(totalMin / 6) / 10}<small>h</small></div><div class="muted">total focus time</div></div>
  </div>
  <div class="grid two">
    <div>
      <section class="card"><h2>By class</h2>${rows}<p class="muted small"><span class="key" style="background:var(--accent)"></span>done <span class="key" style="background:var(--bad)"></span>overdue</p></section>
      ${criteriaMatrix()}
    </div>
    <div>
      <section class="card"><h2>Focus minutes, last 14 days</h2><div class="chart">${chart}</div>
        <p class="muted small">This week: ${weekMin} min focus · ${weekCards} flashcards reviewed</p></section>
      <section class="card"><h2>Focus time by class</h2>${studyRows || '<p class="muted">Finish a focus session to see it here.</p>'}</section>
    </div>
  </div>
  <p class="muted small">A streak counts any day you finished a focus session, reviewed flashcards or ticked off an assignment. Class material is not counted.</p>`;
}

// ================= SCHEDULE =================
// Your Class Scheduler runs in its own frame so its code and styles stay separate from the rest of the app.
export function schedulePage() {
  const theme = state.settings.theme === 'auto' ? '' : state.settings.theme;
  const source = window.SCHEDULER_SRCDOC ? 'data-srcdoc="1"' : 'src="scheduler.html"';
  return `<div class="page-head"><h1>Schedule</h1><a class="btn small" href="#/settings/timetable">Link to Toddle classes</a></div>
  <iframe class="sched-frame" title="Class scheduler" data-hub="1" data-theme="${theme}" data-accent="${esc(state.settings.accent)}" ${source}></iframe>`;
}

// ================= SETTINGS =================
const ACCENTS = ['#4f46e5', '#db2777', '#059669', '#c2410c', '#0369a1', '#7c3aed'];

actions['sync-now'] = async (el) => {
  const url = document.getElementById('feed-url').value.trim();
  state.feedUrl = url;
  save();
  el.disabled = true;
  el.textContent = 'Syncing…';
  try {
    const n = await syncFromFeed();
    syncStatus.error = null;
    toast(`Imported ${n} events`);
    prepareCatchup();
  } catch (e) {
    syncStatus.error = e.details ? `${e.message}\n\n${e.details}` : e.message;
    toast(e.message);
  }
  rerender();
};
actions['copy-error'] = async () => {
  try {
    await navigator.clipboard.writeText(syncStatus.error);
    toast('Copied');
  } catch (e) {
    toast('Could not copy automatically. Select the text and press Ctrl+C.');
  }
};
actions['clear-feed'] = async () => {
  if (!(await ask('Remove the saved link and all imported assignments? Your flashcards and study history stay.', { ok: 'Remove', danger: true }))) return;
  state.feedUrl = '';
  state.events = [];
  state.lastSync = null;
  state.pastPrompted = false;
  state.catchupBefore = null;
  save();
  rerender();
};
changes['upload-ics'] = async (el) => {
  const file = el.files[0];
  if (!file) return;
  try {
    const n = importText(await file.text());
    toast(`Imported ${n} events`);
    prepareCatchup();
  } catch (e) {
    toast(e.message);
  }
  el.value = '';
  rerender();
};
changes['setting'] = (el) => {
  const k = el.dataset.setting;
  let v = el.type === 'checkbox' ? el.checked : el.type === 'number' ? Math.max(1, Number(el.value) || 1) : el.value;
  if (k === 'weekStart') v = Number(v);
  if (k === 'dueAtEnd') v = v === 'end';
  if (k === 'alertNotify' && v && 'Notification' in window && Notification.permission === 'default') Notification.requestPermission();
  state.settings[k] = v;
  dueConfig.end = Boolean(state.settings.dueAtEnd);
  save();
  applyTheme();
  syncDurations();
  rerender();
};
changes['tt-link'] = (el) => {
  state.ttMap[el.dataset.id] = el.value;
  save();
  rerender();
};
actions['unmute-all'] = () => {
  state.mute = {};
  save();
  rerender();
};
actions['accent'] = (el) => {
  state.settings.accent = el.dataset.color;
  save();
  applyTheme();
  rerender();
};
actions['export-data'] = () => {
  const { feedUrl, ...rest } = state;
  try { rest.scheduler = localStorage.getItem(SCHEDULER_KEY); } catch (e) { /* storage unavailable */ }
  download(`study-hub-backup-${today()}.json`, JSON.stringify(rest, null, 2));
};
changes['import-data'] = async (el) => {
  const file = el.files[0];
  el.value = '';
  if (!file) return;
  let data;
  try {
    data = JSON.parse(await file.text());
    if (typeof data !== 'object' || !Array.isArray(data.events)) throw new Error('bad');
  } catch (e) {
    return toast('That is not a valid backup file.');
  }
  if (!(await ask('Replace everything in this browser with the backup?', { ok: 'Replace', danger: true }))) return;
  const { scheduler, ...hubData } = data;
  replaceWith({ ...hubData, feedUrl: state.feedUrl });
  if (typeof scheduler === 'string') {
    try { localStorage.setItem(SCHEDULER_KEY, scheduler); } catch (e) { /* storage unavailable */ }
  }
  dueConfig.end = Boolean(state.settings.dueAtEnd);
  applyTheme();
  toast('Backup restored');
  rerender();
};
actions['reset-all'] = async () => {
  if (!(await ask('Delete ALL data in this browser (assignments, decks, schedule, history, settings)? This cannot be undone.', { ok: 'Delete everything', danger: true }))) return;
  resetAll();
  dueConfig.end = false;
  applyTheme();
  rerender();
};
actions['toggle-url'] = () => {
  const i = document.getElementById('feed-url');
  i.type = i.type === 'password' ? 'text' : 'password';
};

export function applyTheme() {
  const r = document.documentElement;
  if (state.settings.theme === 'auto') r.removeAttribute('data-theme');
  else r.dataset.theme = state.settings.theme;
  r.style.setProperty('--accent', state.settings.accent);
}

function timetableCard() {
  const data = schedulerData();
  if (!data || !data.classes.length) {
    return `<section class="card" id="timetable"><h2>Timetable link</h2><p class="muted">Build your timetable in <a href="#/schedule">Schedule</a> first. Then link each timetable class to its Toddle class here, and the planner, class pages and task details show your lessons and free periods.</p></section>`;
  }
  const links = linkMap(data);
  const names = classNames();
  const L = timetableCycle();
  const rows = data.classes.map((c) => `<label class="field">${esc(c.name || 'Untitled class')}<select data-change="tt-link" data-id="${esc(c.id)}">
    <option value="">Not linked</option>${names.map((n) => `<option value="${esc(n)}" ${links[c.id] === n ? 'selected' : ''}>${esc(classInfo(n).name)} (${esc(classInfo(n).code)})</option>`).join('')}</select></label>`).join('');
  return `<section class="card" id="timetable"><h2>Timetable link</h2>
    <p class="muted small">Matched by name where possible. Change any that are wrong.</p>
    <div class="form-row">${rows}</div>
    ${L > 1 ? `<label class="field">Your timetable repeats every ${L} weeks. Pick any day in a "Week 1" <input type="date" data-change="setting" data-setting="cycleAnchor" value="${esc(state.settings.cycleAnchor)}"></label>
      ${state.settings.cycleAnchor ? '' : '<p class="note">Until you pick a date, every week is treated as Week 1.</p>'}` : ''}
  </section>`;
}

export function settingsPage(section) {
  const s = state.settings;
  const sel = (k, v) => (s[k] === v ? 'selected' : '');
  const chk = (k) => (s[k] ? 'checked' : '');
  const synced = state.lastSync ? new Date(state.lastSync).toLocaleString('en-GB') : 'never';
  return `
  <div class="narrow"><h1>Settings</h1>

  <section class="card"><h2>Toddle import</h2>
    <p class="muted">${state.events.length ? `<strong>${state.events.length}</strong> events loaded (${tasks().length} tasks in ${classNames().length} classes). Last import: ${synced}.` : 'Nothing imported yet.'}</p>
    <label class="field">Toddle calendar link
      <div class="row nowrap"><input id="feed-url" type="password" class="grow" autocomplete="off" spellcheck="false" placeholder="https://…toddleapp.com/calendar/v1/feed/basic.ics?…" value="${esc(state.feedUrl)}">
      <button class="btn small" data-action="toggle-url" type="button">Show</button></div></label>
    <div class="row">
      <button class="btn primary" data-action="sync-now">Sync from link</button>
      <label class="btn">Upload .ics file<input type="file" accept=".ics,text/calendar" data-change="upload-ics" hidden></label>
      ${state.events.length || state.feedUrl ? '<button class="btn danger" data-action="clear-feed">Remove imported data</button>' : ''}
    </div>
    ${getProxy()
      ? `<div class="note info"><strong>Your link is private.</strong> It is saved only in this browser. When you sync, it is sent through the app's sync service, which only forwards it to Toddle. Toddle refreshes its calendar about once a day, so new work can take up to 24 hours to show up.</div>`
      : `<div class="note"><strong>Heads up:</strong> your link contains a private access key, so it is saved only in this browser. Toddle only lets its own website download the feed, so syncing from the link needs a proxy (see the README). Without one, download the .ics file from your link and use <em>Upload .ics file</em>.</div>`}
    ${syncStatus.error ? `<div class="note err"><strong>Last sync problem</strong><pre>${esc(syncStatus.error)}</pre><button class="btn small" data-action="copy-error">Copy details</button></div>` : ''}
    <label class="field">Toddle deadlines are at
      <select data-change="setting" data-setting="dueAtEnd"><option value="start" ${s.dueAtEnd ? '' : 'selected'}>the start of the calendar slot (default)</option><option value="end" ${s.dueAtEnd ? 'selected' : ''}>the end of the calendar slot (30 min later)</option></select>
      <span class="muted small">Toddle exports each task as a 30-minute calendar slot. Check one task in Toddle and pick the one that matches its deadline.</span></label>
    <details><summary class="muted">Advanced: sync service address</summary>
      <label class="field">Proxy address <span class="muted">(leave empty to use the default)</span>
        <input type="url" data-change="setting" data-setting="proxy" placeholder="https://…/exec?url=" value="${esc(s.proxy)}"></label>
    </details>
  </section>

  <section class="card"><h2>Appearance & calendar</h2>
    <div class="form-row">
      <label class="field">Your name<input type="text" maxlength="30" data-change="setting" data-setting="name" value="${esc(s.name)}" placeholder="Shown on the start page"></label>
      <label class="field">Theme<select data-change="setting" data-setting="theme"><option value="auto" ${sel('theme', 'auto')}>Match device</option><option value="light" ${sel('theme', 'light')}>Light</option><option value="dark" ${sel('theme', 'dark')}>Dark</option></select></label>
      <label class="field">Week starts on<select data-change="setting" data-setting="weekStart"><option value="1" ${sel('weekStart', 1)}>Monday</option><option value="0" ${sel('weekStart', 0)}>Sunday</option></select></label>
    </div>
    <div class="field">Accent colour<div class="row">${ACCENTS.map((c) => `<button class="swatch ${s.accent === c ? 'active' : ''}" style="background:${c}" data-action="accent" data-color="${c}" aria-label="Accent ${c}"></button>`).join('')}</div></div>
    <label class="check-row"><input type="checkbox" data-change="setting" data-setting="time24" ${chk('time24')}> Use 24-hour time</label>
    <label class="check-row"><input type="checkbox" data-change="setting" data-setting="hideClosures" ${chk('hideClosures')}> Hide holidays and school closures in the calendar</label>
    <p class="muted small">Class colours: open a class and use <em>Colour</em>.</p>
  </section>

  <section class="card"><h2>Timer</h2>
    <div class="form-row">
      <label class="field">Focus (min)<input type="number" min="1" max="180" data-change="setting" data-setting="focusMin" value="${s.focusMin}"></label>
      <label class="field">Short break<input type="number" min="1" max="60" data-change="setting" data-setting="shortMin" value="${s.shortMin}"></label>
      <label class="field">Long break<input type="number" min="1" max="60" data-change="setting" data-setting="longMin" value="${s.longMin}"></label>
      <label class="field">Long break every<input type="number" min="2" max="10" data-change="setting" data-setting="longEvery" value="${s.longEvery}"></label>
    </div>
    <label class="check-row"><input type="checkbox" data-change="setting" data-setting="sound" ${chk('sound')}> Play a sound when a session ends</label>
    <label class="check-row"><input type="checkbox" data-change="setting" data-setting="notify" ${chk('notify')}> Show a notification when a session ends</label>
  </section>

  <section class="card"><h2>Planner</h2>
    <div class="form-row">
      <label class="field">Daily study limit (min)<input type="number" min="15" max="480" step="5" data-change="setting" data-setting="dailyLimit" value="${s.dailyLimit}"></label>
      <label class="field">Assumed time per assignment (min)<input type="number" min="5" max="480" step="5" data-change="setting" data-setting="defaultEst" value="${s.defaultEst}"></label>
      <label class="field">Revision session length (min)<input type="number" min="10" max="240" step="5" data-change="setting" data-setting="prepMin" value="${s.prepMin}"></label>
    </div>
    <label class="check-row"><input type="checkbox" data-change="setting" data-setting="planWeekends" ${chk('planWeekends')}> Auto-plan on weekends and school holidays</label>
    <label class="check-row"><input type="checkbox" data-change="setting" data-setting="prepSessions" ${chk('prepSessions')}> Add a revision session before each summative (3 days early in weeks with 2+ summatives)</label>
  </section>

  ${timetableCard()}

  <section class="card"><h2>Alerts and sync</h2>
    <label class="check-row"><input type="checkbox" data-change="setting" data-setting="alerts" ${chk('alerts')}> Warn me about overdue and upcoming work</label>
    <div class="form-row">
      <label class="field">Warn this many hours before something is due<input type="number" min="1" max="168" data-change="setting" data-setting="warnHours" value="${s.warnHours}"></label>
      <label class="field">Warn about assessments this many days ahead<input type="number" min="1" max="30" data-change="setting" data-setting="warnAssessDays" value="${s.warnAssessDays}"></label>
    </div>
    <label class="check-row"><input type="checkbox" data-change="setting" data-setting="alertNotify" ${chk('alertNotify')}> Show a browser notification for new warnings while the app is open in another tab</label>
    <label class="check-row"><input type="checkbox" data-change="setting" data-setting="autoSync" ${chk('autoSync')}> Sync from Toddle automatically when I open the app</label>
    <p class="muted small">Class material (slides, videos, feedback) never triggers warnings. Notifications only work while the app is open in a browser tab.${Object.keys(state.mute).length ? ` <button class="linkbtn" data-action="unmute-all">Stop ignoring ${Object.keys(state.mute).length} muted item(s)</button>` : ''}</p>
  </section>

  <section class="card"><h2>Your data</h2>
    <p class="muted">Everything lives in this browser. Export a backup to move to another device (your Toddle link is left out of backups).</p>
    <div class="row">
      <button class="btn" data-action="export-data">Export backup</button>
      <label class="btn">Restore backup<input type="file" accept=".json,application/json" data-change="import-data" hidden></label>
      <button class="btn danger" data-action="reset-all">Delete everything</button>
    </div>
  </section></div>`.replace(section === 'timetable' ? 'id="timetable"' : '\u0000', 'id="timetable" data-focus="1"');
}

