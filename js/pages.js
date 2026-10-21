// Page views: Start, Classes, Class, Calendar, Progress, Settings.
import { state, save, classNames, classInfo, classStats, classColor, tasks, tasksFor, isDone, toggleDone, studyMinutesOn, resetAll, replaceWith } from './store.js';
import { esc, today, addDays, diffDays, fmtDate, fmtTime, ymd, parseYmd, download } from './util.js';
import { taskRow, eventRow, emptyState, bar, typeBadge } from './components.js';
import { dueCardCount } from './cards.js';
import { actions, changes, inputs, rerender, toast } from './ui.js';
import { syncFromFeed, importText, offerMarkPastDone } from './sync.js';
import { syncDurations } from './timer.js';

const greeting = () => {
  const h = new Date().getHours();
  return h < 5 ? 'Still up' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
};

const importCta = () =>
  emptyState('📥', 'Import your Toddle calendar', 'Add your Toddle calendar link or file and every assignment gets sorted into its class.', '<a class="btn primary" href="#/settings">Go to import</a>');

// ================= START =================
export function startPage() {
  const name = state.settings.name ? `, ${esc(state.settings.name)}` : '';
  const head = `<div class="hero"><div><h1>${greeting()}${name} 👋</h1><p class="muted">${fmtDate(today(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p></div></div>`;
  if (!state.events.length) return head + importCta();

  const t = today();
  const all = tasks();
  const open = all.filter((e) => !isDone(e.uid));
  const overdue = open.filter((e) => e.date < t);
  const week = open.filter((e) => e.date >= t && e.date <= addDays(t, 7));
  const assess = open.filter((e) => /Assessment/.test(e.type) && e.date >= t).slice(0, 4);
  const dueToday = open.filter((e) => e.date === t).length;
  const nextOff = state.events.find((e) => e.kind === 'event' && e.type === 'Holidays and vacations' && e.endDate >= t);

  const days = {};
  week.forEach((e) => (days[e.date] ||= []).push(e));
  const dayBlocks = Object.keys(days).sort().map((d) => `<h3 class="day-h">${fmtDate(d)} <span class="muted">${d === t ? 'Today' : diffDays(d, t) === 1 ? 'Tomorrow' : ''}</span></h3>${days[d].map((e) => taskRow(e)).join('')}`).join('');

  return `${head}
  <div class="grid stats">
    <div class="card stat"><div class="stat-num">${dueToday}</div><div class="muted">due today</div></div>
    <div class="card stat ${overdue.length ? 'warn' : ''}"><div class="stat-num">${overdue.length}</div><div class="muted">overdue</div></div>
    <div class="card stat"><div class="stat-num">${week.length}</div><div class="muted">next 7 days</div></div>
    <div class="card stat"><div class="stat-num">${studyMinutesOn(t)}<small>min</small></div><div class="muted">studied today</div></div>
  </div>
  <div class="grid two">
    <div>
      ${overdue.length ? `<section class="card"><div class="sec-head"><h2>Overdue</h2><button class="btn small" data-action="mark-overdue-done">Mark all done</button></div>${overdue.slice(0, 5).map((e) => taskRow(e)).join('')}${overdue.length > 5 ? `<p class="muted small">+ ${overdue.length - 5} more — open a class to see them.</p>` : ''}</section>` : ''}
      <section class="card"><h2>Coming up</h2>${dayBlocks || '<p class="muted">Nothing due in the next 7 days. Nice.</p>'}</section>
    </div>
    <div>
      <section class="card"><h2>Study tools</h2>
        <div class="quick">
          <a class="quick-btn" href="#/timer">⏱️<span>Start focus timer</span></a>
          <a class="quick-btn" href="#/flashcards">🗂️<span>Flashcards${dueCardCount() ? ` · ${dueCardCount()} due` : ''}</span></a>
          <a class="quick-btn" href="#/calendar">📅<span>Calendar</span></a>
          <a class="quick-btn" href="#/progress">📈<span>Progress</span></a>
        </div></section>
      <section class="card"><h2>Upcoming assessments</h2>
        ${assess.length ? assess.map((e) => `<a class="mini-row" href="#/class/${encodeURIComponent(e.classes[0])}" style="--c:${classColor(e.classes[0])}"><span class="mini-title">${esc(e.title)}</span><span class="muted small">${typeBadge(e)} ${fmtDate(e.date)}</span></a>`).join('') : '<p class="muted">No assessments coming up.</p>'}
      </section>
      ${nextOff ? `<section class="card"><h2>Next time off</h2><p><strong>${esc(nextOff.title)}</strong><br><span class="muted">${fmtDate(nextOff.date)}${nextOff.endDate !== nextOff.date ? ' – ' + fmtDate(nextOff.endDate) : ''}</span></p></section>` : ''}
    </div>
  </div>`;
}

actions['toggle'] = (el) => {
  toggleDone(el.dataset.uid);
  rerender();
};
actions['mark-overdue-done'] = () => {
  const t = today();
  tasks().filter((e) => e.date < t && !isDone(e.uid)).forEach((e) => toggleDone(e.uid, 'bulk'));
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
    return `<a class="card class-card" href="#/class/${encodeURIComponent(c)}" style="--c:${i.color}">
      <div class="cc-top"><h3>${esc(i.name)}</h3><span class="muted small">${esc(i.code)}</span></div>
      <div class="cc-nums"><span><strong>${s.open}</strong> open</span>${s.overdue ? `<span class="late"><strong>${s.overdue}</strong> overdue</span>` : ''}<span class="muted">${s.total} total</span></div>
      ${bar([{ v: pct, c: i.color, t: 'done' }])}
      <div class="muted small">${s.next ? `Next: ${esc(s.next.title)} · ${fmtDate(s.next.date)}` : 'Nothing upcoming'}</div>
    </a>`;
  }).join('');
  return `<div class="page-head"><h1>Classes</h1><span class="muted">${tasks().length} assignments in ${names.length} classes</span></div><div class="grid classes">${cards}</div>`;
}

let classFilter = 'open';
let typeFilter = '';
let search = '';
actions['class-filter'] = (el) => {
  classFilter = el.dataset.f;
  rerender();
};
changes['type-filter'] = (el) => {
  typeFilter = el.value;
  rerender();
};
inputs['search'] = (el) => {
  search = el.value;
  const pos = el.selectionStart;
  rerender();
  const again = document.querySelector('[data-input="search"]');
  if (again) {
    again.focus();
    again.setSelectionRange(pos, pos);
  }
};
actions['class-mark-past'] = (el) => {
  const t = today();
  tasksFor(el.dataset.cls).filter((e) => e.date < t && !isDone(e.uid)).forEach((e) => toggleDone(e.uid, 'bulk'));
  rerender();
};

export function classPage(name) {
  if (!classNames().includes(name)) return emptyState('🤔', 'Class not found', '<a href="#/classes">Back to classes</a>');
  const i = classInfo(name);
  const t = today();
  const all = tasksFor(name);
  const types = [...new Set(all.map((e) => e.type))];
  let list = all.filter((e) => (classFilter === 'open' ? !isDone(e.uid) : classFilter === 'done' ? isDone(e.uid) : true));
  if (typeFilter) list = list.filter((e) => e.type === typeFilter);
  if (search.trim()) {
    const q = search.trim().toLowerCase();
    list = list.filter((e) => (e.title + ' ' + e.description).toLowerCase().includes(q));
  }
  const overdue = list.filter((e) => e.date < t && !isDone(e.uid));
  const upcoming = list.filter((e) => e.date >= t);
  const past = list.filter((e) => e.date < t && isDone(e.uid)).reverse();
  const section = (title, arr) => (arr.length ? `<h3 class="day-h">${title} <span class="muted">${arr.length}</span></h3>${arr.map((e) => taskRow(e, { showClass: false })).join('')}` : '');
  const s = classStats(name);
  const chips = [['open', 'Open'], ['all', 'All'], ['done', 'Done']].map(([k, l]) => `<button class="chip ${classFilter === k ? 'active' : ''}" data-action="class-filter" data-f="${k}">${l}</button>`).join('');
  return `
  <a class="muted small" href="#/classes">← All classes</a>
  <div class="page-head class-head" style="--c:${i.color}"><div><h1>${esc(i.name)}</h1><div class="muted">${esc(i.code)} · ${s.done}/${s.total} done${s.overdue ? ` · <span class="late">${s.overdue} overdue</span>` : ''}</div></div>
    ${s.overdue ? `<button class="btn small" data-action="class-mark-past" data-cls="${esc(name)}">Mark past as done</button>` : ''}</div>
  <div class="filters">
    <div class="row">${chips}</div>
    <select data-change="type-filter" aria-label="Filter by type"><option value="">All types</option>${types.map((x) => `<option ${typeFilter === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>
    <input type="search" data-input="search" placeholder="Search…" value="${esc(search)}" aria-label="Search assignments">
  </div>
  ${section('Overdue', overdue)}${section('Upcoming', upcoming)}${section('Earlier', past)}
  ${list.length ? '' : '<p class="muted">Nothing matches these filters.</p>'}`;
}

// ================= CALENDAR =================
const now = new Date();
const cal = { y: now.getFullYear(), m: now.getMonth(), sel: today() };

actions['cal-prev'] = () => { cal.m--; if (cal.m < 0) { cal.m = 11; cal.y--; } rerender(); };
actions['cal-next'] = () => { cal.m++; if (cal.m > 11) { cal.m = 0; cal.y++; } rerender(); };
actions['cal-today'] = () => { const d = new Date(); cal.y = d.getFullYear(); cal.m = d.getMonth(); cal.sel = today(); rerender(); };
actions['cal-select'] = (el) => { cal.sel = el.dataset.date; rerender(); };

function eventsByDay() {
  const map = {};
  for (const e of state.events) {
    if (state.settings.hideClosures && e.type === 'Holidays and vacations') continue;
    let d = e.date;
    for (let n = 0; n < 60 && d <= e.endDate; n++, d = addDays(d, 1)) (map[d] ||= []).push(e);
  }
  return map;
}

export function calendarPage() {
  const ws = Number(state.settings.weekStart);
  const first = new Date(cal.y, cal.m, 1);
  const offset = (first.getDay() - ws + 7) % 7;
  const start = new Date(cal.y, cal.m, 1 - offset);
  const map = eventsByDay();
  const t = today();
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const heads = Array.from({ length: 7 }, (_, i) => `<div class="cal-dow">${names[(ws + i) % 7]}</div>`).join('');
  let cells = '';
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const key = ymd(d);
    const evs = map[key] || [];
    const chips = evs.slice(0, 3).map((e) => {
      const c = e.kind === 'task' ? classColor(e.classes[0]) : e.type === 'Holidays and vacations' ? 'var(--muted)' : 'var(--accent)';
      return `<span class="cal-chip ${e.kind === 'task' && isDone(e.uid) ? 'is-done' : ''}" style="--c:${c}">${esc(e.title)}</span>`;
    }).join('');
    cells += `<button class="cal-cell ${d.getMonth() !== cal.m ? 'other' : ''} ${key === t ? 'today' : ''} ${key === cal.sel ? 'selected' : ''}" data-action="cal-select" data-date="${key}" aria-label="${fmtDate(key)}, ${evs.length} events">
      <span class="cal-num">${d.getDate()}</span><span class="cal-chips">${chips}</span>${evs.length > 3 ? `<span class="cal-more">+${evs.length - 3}</span>` : ''}</button>`;
  }
  const sel = (map[cal.sel] || []).slice().sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  const title = new Date(cal.y, cal.m, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  return `
  <div class="page-head"><h1>Calendar</h1>
    <div class="row"><button class="btn small" data-action="cal-prev" aria-label="Previous month">‹</button><strong class="cal-title">${title}</strong><button class="btn small" data-action="cal-next" aria-label="Next month">›</button><button class="btn small" data-action="cal-today">Today</button></div></div>
  ${state.events.length ? '' : '<p class="muted">Import your Toddle calendar in Settings to see assignments here.</p>'}
  <div class="cal">${heads}${cells}</div>
  <section class="card"><h2>${fmtDate(cal.sel, { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
    ${sel.length ? sel.map((e) => (e.kind === 'task' ? taskRow(e) : eventRow(e))).join('') : '<p class="muted">Nothing on this day.</p>'}</section>`;
}

// ================= PROGRESS =================
export function progressPage() {
  if (!state.events.length) return '<h1>Progress</h1>' + importCta();
  const t = today();
  const all = tasks();
  const dueNow = all.filter((e) => e.date <= t);
  const doneAll = all.filter((e) => isDone(e.uid));
  const doneDue = dueNow.filter((e) => isDone(e.uid));
  const pct = dueNow.length ? Math.round((100 * doneDue.length) / dueNow.length) : 100;

  const rows = classNames().map((c) => {
    const i = classInfo(c);
    const list = tasksFor(c);
    const n = list.length || 1;
    const d = list.filter((e) => isDone(e.uid)).length;
    const od = list.filter((e) => !isDone(e.uid) && e.date < t).length;
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
    <div class="card stat"><div class="stat-num">${doneAll.length}<small>/${all.length}</small></div><div class="muted">assignments done</div></div>
    <div class="card stat"><div class="stat-num">${streak}<small>d</small></div><div class="muted">day streak</div></div>
    <div class="card stat"><div class="stat-num">${Math.round(totalMin / 6) / 10}<small>h</small></div><div class="muted">total focus time</div></div>
  </div>
  <div class="grid two">
    <section class="card"><h2>By class</h2>${rows}<p class="muted small"><span class="key" style="background:var(--accent)"></span>done <span class="key" style="background:var(--bad)"></span>overdue</p></section>
    <div>
      <section class="card"><h2>Focus minutes, last 14 days</h2><div class="chart">${chart}</div>
        <p class="muted small">This week: ${weekMin} min focus · ${weekCards} flashcards reviewed</p></section>
      <section class="card"><h2>Focus time by class</h2>${studyRows || '<p class="muted">Finish a focus session to see it here.</p>'}</section>
    </div>
  </div>
  <p class="muted small">A streak counts any day you finished a focus session, reviewed flashcards or ticked off an assignment.</p>`;
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
    toast(`Imported ${n} events`);
    offerMarkPastDone();
  } catch (e) {
    toast(e.message);
  }
  rerender();
};
actions['clear-feed'] = () => {
  if (confirm('Remove the saved link and all imported assignments? Your flashcards and study history stay.')) {
    state.feedUrl = '';
    state.events = [];
    state.lastSync = null;
    state.pastPrompted = false;
    save();
    rerender();
  }
};
changes['upload-ics'] = async (el) => {
  const file = el.files[0];
  if (!file) return;
  try {
    const n = importText(await file.text());
    toast(`Imported ${n} events`);
    offerMarkPastDone();
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
  state.settings[k] = v;
  save();
  applyTheme();
  syncDurations();
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
  download(`study-hub-backup-${today()}.json`, JSON.stringify(rest, null, 2));
};
changes['import-data'] = async (el) => {
  const file = el.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (typeof data !== 'object' || !Array.isArray(data.events)) throw new Error('bad');
    if (confirm('Replace everything in this browser with the backup?')) {
      replaceWith({ ...data, feedUrl: state.feedUrl });
      applyTheme();
      toast('Backup restored');
    }
  } catch (e) {
    toast('That is not a valid backup file.');
  }
  el.value = '';
  rerender();
};
actions['reset-all'] = () => {
  if (confirm('Delete ALL data in this browser (assignments, decks, history, settings)? This cannot be undone.')) {
    resetAll();
    applyTheme();
    rerender();
  }
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

export function settingsPage() {
  const s = state.settings;
  const sel = (k, v) => (s[k] === v ? 'selected' : '');
  const chk = (k) => (s[k] ? 'checked' : '');
  const synced = state.lastSync ? new Date(state.lastSync).toLocaleString('en-GB') : 'never';
  return `
  <h1>Settings</h1>

  <section class="card"><h2>Toddle import</h2>
    <p class="muted">${state.events.length ? `<strong>${state.events.length}</strong> events loaded (${tasks().length} assignments in ${classNames().length} classes). Last import: ${synced}.` : 'Nothing imported yet.'}</p>
    <label class="field">Toddle calendar link
      <div class="row nowrap"><input id="feed-url" type="password" class="grow" autocomplete="off" spellcheck="false" placeholder="https://…toddleapp.com/calendar/v1/feed/basic.ics?…" value="${esc(state.feedUrl)}">
      <button class="btn small" data-action="toggle-url" type="button">Show</button></div></label>
    <div class="row">
      <button class="btn primary" data-action="sync-now">Sync from link</button>
      <label class="btn">Upload .ics file<input type="file" accept=".ics,text/calendar" data-change="upload-ics" hidden></label>
      ${state.events.length || state.feedUrl ? '<button class="btn danger" data-action="clear-feed">Remove imported data</button>' : ''}
    </div>
    <div class="note"><strong>Heads up:</strong> your link contains a private access key, so it is saved only in this browser and never in the site's code. Toddle only lets its own website download the feed, so syncing from the link needs a small proxy (see the README). Without one, download the file from the link and use <em>Upload .ics file</em> instead.</div>
    <label class="field">Proxy address <span class="muted">(optional)</span>
      <input type="url" data-change="setting" data-setting="proxy" placeholder="https://your-worker.workers.dev/?url=" value="${esc(s.proxy)}"></label>
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

  <section class="card"><h2>Your data</h2>
    <p class="muted">Everything lives in this browser. Export a backup to move to another device (your Toddle link is left out of backups).</p>
    <div class="row">
      <button class="btn" data-action="export-data">Export backup</button>
      <label class="btn">Restore backup<input type="file" accept=".json,application/json" data-change="import-data" hidden></label>
      <button class="btn danger" data-action="reset-all">Delete everything</button>
    </div>
  </section>`;
}
