// To-do list across all classes (Upcoming / Overdue / Done / Class material) and the one-time catch-up
// that sorts out work which was already past due when the calendar was first imported.
import { state, save, tasks, isDone, kindOf, classNames, classInfo, setStatus, isCatchup } from './store.js';
import { esc, today, fmtDate, diffDays, displayTitle } from './util.js';
import { isOverdue, dueMs } from './urgency.js';
import { taskRow, emptyState, tagsFor, dueText } from './components.js';
import { actions, changes, inputs, rerender, toast } from './ui.js';
import { ask } from './dialog.js';

// ---------- catch-up ----------
export function catchupItems() {
  return tasks().filter(isCatchup);
}

export function catchupCard() {
  const items = catchupItems();
  if (!items.length) return '';
  return `<section class="card catchup">
    <div><h2>Catch up on ${items.length} older assignments</h2>
    <p class="muted">These were already past their due date when you imported your calendar. Toddle's feed doesn't say what you handed in, so most of them are probably done.</p></div>
    <div class="row"><button class="btn primary" data-action="catchup-all">Mark all as done</button><a class="btn" href="#/catchup">Go through them</a><button class="btn" data-action="catchup-keep">Keep them as to-dos</button></div>
  </section>`;
}

const markDoneQuietly = (uid) => {
  state.status[uid] = 'todo';
  state.done[uid] = 'bulk'; // 'bulk' so it doesn't count toward today's streak
};

actions['catchup-all'] = async () => {
  const items = catchupItems();
  if (!(await ask(`Mark ${items.length} older assignments as done? You can still change any of them later.`, { ok: 'Mark done' }))) return;
  items.forEach((e) => markDoneQuietly(e.uid));
  state.catchupBefore = null;
  save();
  toast(`Marked ${items.length} as done`);
  rerender();
};
actions['catchup-keep'] = () => {
  state.catchupBefore = null;
  save();
  rerender();
};
actions['catchup-set'] = (el) => {
  const { uid, s } = el.dataset;
  if (s === 'done') markDoneQuietly(uid);
  else setStatus(uid, s);
  save();
  rerender();
};

export function catchupPage() {
  const items = catchupItems().sort((a, b) => b.date.localeCompare(a.date));
  if (!items.length) {
    if (state.catchupBefore) { state.catchupBefore = null; save(); }
    return '<h1>Catch up</h1>' + emptyState('✅', 'All sorted', 'Every older assignment has a status now.', '<a class="btn primary" href="#/">Back to Start</a>');
  }
  const by = {};
  items.forEach((e) => (by[e.classes[0] || ''] ||= []).push(e));
  const btn = (e, s, label, cls = '') => `<button class="btn small ${cls}" data-action="catchup-set" data-uid="${esc(e.uid)}" data-s="${s}">${label}</button>`;
  const groups = Object.keys(by).sort((a, b) => classInfo(a).name.localeCompare(classInfo(b).name)).map((c) => {
    const i = classInfo(c);
    return `<h3 class="day-h"><i class="dot" style="--c:${i.color}"></i> ${esc(i.name)} <span class="count">${by[c].length}</span></h3>
    <div class="card flush"><div class="alist">${by[c].map((e) => `
      <div class="arow"><div class="arow-main"><button class="task-title task-open linkish" data-action="open-task" data-uid="${esc(e.uid)}">${esc(displayTitle(e.title))}</button>
        <div class="task-meta">${tagsFor(e)}<span>${esc(dueText(e))}</span></div></div>
        <div class="arow-actions">${btn(e, 'done', 'Done', 'primary')}${btn(e, 'material', 'Not homework')}${btn(e, 'todo', 'Still to do')}</div></div>`).join('')}
    </div></div>`;
  }).join('');
  return `<div class="page-head"><div><h1>Catch up</h1><p class="muted">${items.length} left. Sort each one, or finish in one go.</p></div>
    <div class="row"><button class="btn primary" data-action="catchup-all">Mark the rest as done</button></div></div>${groups}`;
}

// ---------- to-do list ----------
const TABS = { upcoming: 'Upcoming', overdue: 'Overdue', done: 'Done', material: 'Class material' };
const f = { cls: '', teacher: '', type: '', q: '' };

changes['todo-filter'] = (el) => {
  f[el.dataset.k] = el.value;
  rerender();
};
inputs['todo-search'] = (el) => {
  f.q = el.value;
  const box = document.getElementById('todo-list');
  if (box) box.innerHTML = listHtml(currentTab);
};

let currentTab = 'upcoming';

function inTab(e, tab) {
  const k = kindOf(e);
  if (tab === 'material') return k === 'material';
  if (k !== 'todo') return false;
  if (tab === 'done') return isDone(e.uid);
  if (isDone(e.uid)) return false;
  return tab === 'overdue' ? isOverdue(e) : !isOverdue(e);
}

function filtered(tab) {
  const q = f.q.trim().toLowerCase();
  return tasks().filter((e) => inTab(e, tab)
    && (!f.cls || e.classes.includes(f.cls))
    && (!f.teacher || e.createdBy === f.teacher)
    && (!f.type || e.type === f.type)
    && (!q || (e.title + ' ' + e.description + ' ' + e.createdBy).toLowerCase().includes(q)));
}

function listHtml(tab) {
  const list = filtered(tab);
  if (!list.length) {
    const msg = { upcoming: 'Nothing coming up. Nice.', overdue: 'Nothing overdue.', done: 'Nothing ticked off yet.', material: 'No class material.' }[tab];
    return `<p class="muted pad">${msg}</p>`;
  }
  const t = today();
  const groups = new Map();
  const put = (k, e) => (groups.has(k) ? groups.get(k).push(e) : groups.set(k, [e]));
  if (tab === 'upcoming') {
    list.sort((a, b) => dueMs(a) - dueMs(b)).forEach((e) => {
      const d = diffDays(e.date, t);
      put(d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : d < 7 ? fmtDate(e.date, { weekday: 'long', day: 'numeric', month: 'short' }) : d < 14 ? 'Next week' : 'Later', e);
    });
  } else if (tab === 'overdue') {
    list.sort((a, b) => dueMs(b) - dueMs(a)).forEach((e) => put(diffDays(t, e.date) <= 7 ? 'This week' : 'Older', e));
  } else {
    list.sort((a, b) => b.date.localeCompare(a.date)).forEach((e) => put(new Date(e.date + 'T12:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }), e));
  }
  return [...groups].map(([k, arr]) => `<h3 class="day-h">${esc(k)} <span class="count">${arr.length}</span></h3><div class="card flush"><div class="list">${arr.map((e) => taskRow(e, { showRel: tab !== 'done' })).join('')}</div></div>`).join('');
}

export function todoPage(tab) {
  currentTab = TABS[tab] ? tab : 'upcoming';
  if (!state.events.length) return '<h1>To-do</h1>' + emptyState('📥', 'Nothing imported yet', 'Import your Toddle calendar to see your to-dos.', '<a class="btn primary" href="#/settings">Go to import</a>');
  const counts = Object.fromEntries(Object.keys(TABS).map((k) => [k, tasks().filter((e) => inTab(e, k)).length]));
  const tabs = Object.entries(TABS).map(([k, l]) => `<a class="tab ${k === currentTab ? 'active' : ''} ${k === 'overdue' && counts[k] ? 'tab-hot' : ''}" href="#/todo/${k}" ${k === currentTab ? 'aria-current="page"' : ''}>${l} <span class="count">${counts[k]}</span></a>`).join('');
  const all = tasks();
  const teachers = [...new Set(all.map((e) => e.createdBy).filter(Boolean))].sort();
  const types = [...new Set(all.map((e) => e.type))].sort();
  const opt = (v, label, cur) => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(label)}</option>`;
  return `<div class="page-head"><h1>To-do</h1><a class="btn small" href="#/catchup" ${state.catchupBefore ? '' : 'hidden'}>Catch up</a></div>
  <nav class="tabs left" aria-label="To-do lists">${tabs}</nav>
  <div class="filters">
    <select data-change="todo-filter" data-k="cls" aria-label="Class"><option value="">All classes</option>${classNames().map((c) => opt(c, classInfo(c).name, f.cls)).join('')}</select>
    <select data-change="todo-filter" data-k="teacher" aria-label="Teacher"><option value="">All teachers</option>${teachers.map((x) => opt(x, x, f.teacher)).join('')}</select>
    <select data-change="todo-filter" data-k="type" aria-label="Type"><option value="">All types</option>${types.map((x) => opt(x, x, f.type)).join('')}</select>
    <input type="search" data-input="todo-search" placeholder="Search…" value="${esc(f.q)}" aria-label="Search">
  </div>
  <div id="todo-list">${listHtml(currentTab)}</div>`;
}

