// Alerts: what is overdue or due soon, what is new from Toddle, and a direct way to deal with each.
import { state, save, tasks, isDone, isTodo, isCatchup, toggleDone } from './store.js';

// Warnings cover to-dos only, and not the older work waiting in the one-time catch-up.
const alertable = (e) => isTodo(e) && !isCatchup(e);
import { classify, humanSpan, DAY } from './urgency.js';
import { esc, today, fmtDate, fmtTime, displayTitle } from './util.js';
import { actions, rerender, toast } from './ui.js';
import { emptyState, tagsFor, dueText, classLabel } from './components.js';
import { syncStatus, backgroundSync, getProxy } from './sync.js';
import { focusOn } from './timer.js';
import { showWeekOf } from './planner.js';

const num = (v, fallback) => (Number(v) > 0 ? Number(v) : fallback);

export function currentAlerts(now = Date.now()) {
  const s = state.settings;
  const all = tasks();
  const found = classify(all, {
    now,
    warnHours: num(s.warnHours, 24),
    assessDays: num(s.warnAssessDays, 3),
    isDone,
    isMuted: (uid) => Boolean(state.mute[uid]),
    isTodo: alertable,
  });
  const byUid = new Map(all.map((e) => [e.uid, e]));
  const news = (state.changes || [])
    .map((c) => ({ ...c, e: byUid.get(c.uid) }))
    .filter((c) => c.e && alertable(c.e) && !isDone(c.uid) && !state.mute[c.uid] && now - c.at < 3 * DAY);
  return { ...found, news, count: found.overdue.length + found.soon.length };
}

// ---- rows ----
const classLink = (e) => `#/class/${encodeURIComponent(e.classes[0] || '')}/${encodeURIComponent(e.uid)}`;

function alertRow(item, kind) {
  const e = item.e;
  const id = esc(e.uid);
  const hot = kind === 'overdue' || item.urgent;
  const when = kind === 'overdue' ? `Overdue by ${humanSpan(item.late)}` : `Due in ${humanSpan(item.left)}`;
  const cls = e.classes[0] || '';
  const decks = state.decks.filter((d) => d.link === e.uid);
  return `
  <div class="arow ${hot ? 'hot' : ''}">
    <div class="arow-main">
      <button class="task-title task-open linkish" data-action="open-task" data-uid="${id}">${esc(displayTitle(e.title))}</button>
      <div class="task-meta"><span class="${hot ? 'late' : 'soonc'}">${when}</span><span>${esc(dueText(e))}</span>${tagsFor(e)}${e.classes.map(classLabel).join('')}</div>
    </div>
    <div class="arow-actions">
      <button class="btn small" data-action="toggle" data-uid="${id}">Done</button>
      ${state.plan[e.uid] === today() ? '<span class="muted small">Planned today ✓</span>' : `<button class="btn small" data-action="alert-today" data-uid="${id}">Plan today</button>`}
      <details class="more"><summary class="btn small" aria-label="More actions">⋯</summary>
        <div class="more-menu">
          <a href="${classLink(e)}">Open in class</a>
          <button data-action="alert-planner" data-date="${kind === 'overdue' ? today() : e.date}">Open in planner</button>
          ${e.link ? `<a href="${esc(e.link)}" target="_blank" rel="noopener noreferrer">Open in Toddle ↗</a>` : ''}
          ${decks.map((d) => `<a href="#/flashcards/${d.id}">Study cards: ${esc(d.name)}</a>`).join('')}
          <button data-action="alert-timer" data-cls="${esc(cls)}">Start timer</button>
          <button data-action="set-status" data-uid="${id}" data-s="material">Not homework</button>
          <button data-action="alert-mute" data-uid="${id}">Ignore this one</button>
        </div>
      </details>
    </div>
  </div>`;
}

function newsRow(c) {
  const e = c.e;
  const what = c.kind === 'new'
    ? 'New'
    : `Moved from ${fmtDate(c.from.date)}${c.from.time ? ' ' + fmtTime(c.from.time, state.settings.time24) : ''}`;
  return `
  <div class="arow">
    <div class="arow-main">
      <button class="task-title task-open linkish" data-action="open-task" data-uid="${esc(e.uid)}">${esc(displayTitle(e.title))}</button>
      <div class="task-meta"><span class="soonc">${what}</span><span>Due ${esc(dueText(e))}</span>${tagsFor(e)}${e.classes.map(classLabel).join('')}</div>
    </div>
    <div class="arow-actions"><button class="btn small" data-action="open-task" data-uid="${esc(e.uid)}">Open</button></div>
  </div>`;
}

const section = (title, count, body, extra = '') =>
  `<section class="card"><div class="sec-head"><h2>${title} <span class="count">${count}</span></h2>${extra}</div><div class="alist">${body}</div></section>`;

// ---- pages and cards ----
export function alertsPage() {
  if (!state.events.length) {
    return '<h1>Needs attention</h1>' + emptyState('📥', 'Nothing imported yet', 'Import your Toddle calendar and this page will warn you about overdue and upcoming work.', '<a class="btn primary" href="#/settings">Go to import</a>');
  }
  const a = currentAlerts();
  const head = `<div class="page-head"><div><h1>Needs attention</h1><p class="muted">${syncLineHtml()}</p></div><a class="btn small" href="#/settings">Alert settings</a></div>`;
  if (!a.count && !a.news.length && !a.older) {
    return head + emptyState('✅', 'All clear', `Nothing is overdue and nothing is due in the next ${num(state.settings.warnHours, 24)} hours.`);
  }
  const overdueBody = a.overdue.map((x) => alertRow(x, 'overdue')).join('')
    + (a.older ? `<p class="muted small">${a.older} older overdue item${a.older > 1 ? 's are' : ' is'} not listed. <button class="linkbtn" data-action="mark-older-done">Mark them done</button></p>` : '');
  return `${head}
  ${a.overdue.length || a.older ? section('Overdue', a.overdue.length, overdueBody) : ''}
  ${a.soon.length ? section('Due soon', a.soon.length, a.soon.map((x) => alertRow(x, 'soon')).join('')) : ''}
  ${a.news.length ? section('New or changed in Toddle', a.news.length, a.news.map(newsRow).join(''), '<button class="btn small" data-action="changes-seen">Mark as seen</button>') : ''}`;
}

// Compact version for the Start page: the most pressing items first.
export function needsAttentionCard() {
  const a = currentAlerts();
  if (!a.count && !a.news.length) return '';
  const rows = [
    ...a.soon.filter((x) => x.urgent).map((x) => [x, 'soon']),
    ...a.overdue.map((x) => [x, 'overdue']),
    ...a.soon.filter((x) => !x.urgent).map((x) => [x, 'soon']),
  ];
  return `<section class="card attn"><div class="sec-head"><h2>Needs attention <span class="count">${a.count || ''}</span></h2><a class="btn small" href="#/alerts">See all</a></div>
    ${rows.length ? `<div class="alist">${rows.slice(0, 5).map(([x, k]) => alertRow(x, k)).join('')}</div>` : ''}
    ${rows.length > 5 ? `<p class="muted small">+ ${rows.length - 5} more. <a href="#/alerts">See all</a></p>` : ''}
    ${a.news.length ? `<p class="muted small"><a href="#/alerts">${a.news.length} new or changed in Toddle</a></p>` : ''}</section>`;
}

// ---- actions ----
actions['alert-today'] = (el) => {
  state.plan[el.dataset.uid] = today();
  save();
  toast('Planned for today');
  rerender();
};
actions['alert-planner'] = (el) => {
  showWeekOf(el.dataset.date);
  location.hash = '#/planner';
};
actions['alert-timer'] = (el) => {
  focusOn(el.dataset.cls);
  location.hash = '#/timer';
};
actions['alert-mute'] = (el) => {
  state.mute[el.dataset.uid] = true;
  save();
  toast('Ignored. You can undo this in Settings → Alerts.');
  rerender();
};
actions['changes-seen'] = () => {
  state.changes = [];
  save();
  rerender();
};
actions['mark-older-done'] = () => {
  const now = Date.now();
  const isMuted = (u) => Boolean(state.mute[u]);
  tasks().filter((e) => classify([e], { now, isDone, isMuted, isTodo: alertable }).older > 0).forEach((e) => toggleDone(e.uid, 'bulk'));
  rerender();
};

// ---- sync status ----
const ago = (ts) => {
  const m = Math.round((Date.now() - ts) / 60000);
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 48 * 60 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`;
};
const canSync = () => Boolean(state.feedUrl && getProxy());

function syncText() {
  if (syncStatus.busy) return 'Syncing…';
  if (syncStatus.error) return 'Sync failed. Retry';
  return state.lastSync ? `Synced ${ago(state.lastSync)}` : 'Not synced yet';
}

// "Synced 3 min ago · Sync now" for page headers.
export function syncLineHtml() {
  if (!canSync()) return state.events.length ? 'Updates come from the file you uploaded.' : '';
  return `<span id="sync-line"><span class="${syncStatus.error ? 'late' : ''}">${esc(syncText())}</span> · <button class="linkbtn" data-action="sync-bg">Sync now</button></span>`;
}

actions['sync-bg'] = async () => {
  if (!canSync()) return toast('Add your Toddle link in Settings first.');
  const r = await backgroundSync('manual');
  updateChrome();
  if (r && r.error) toast('Sync failed. Details are in Settings.');
  else if (r && r.changed) {
    toast('Updated from Toddle');
    rerender();
  } else toast('Already up to date');
};

// ---- banner, nav badge, sync chip, notifications ----
let hiddenSig = '';
const hash = (str) => [...str].reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0).toString(36);

function bannerHtml(a) {
  // The Start page and the alert pages already show this, so no banner there (one warning, not three).
  if (state.settings.alerts === false || /^#\/(alerts|todo)?$|^$|^#$|^#\/todo\//.test(location.hash)) return '';
  if (!a.count && !a.news.length) return '';
  const sig = hash([...a.overdue, ...a.soon].map((x) => x.e.uid).concat(a.news.map((c) => c.uid + c.kind)).join('|'));
  if (sig === hiddenSig) return '';
  const urgent = a.soon.filter((x) => x.urgent).length;
  const later = a.soon.length - urgent;
  const parts = [];
  if (a.overdue.length) parts.push(`<b>${a.overdue.length}</b> overdue`);
  if (urgent) parts.push(`<b>${urgent}</b> due within 3 hours`);
  if (later) parts.push(`<b>${later}</b> due soon`);
  if (a.news.length) parts.push(`<b>${a.news.length}</b> new or changed`);
  const hot = a.overdue.length > 0 || urgent > 0;
  return `<div class="alertbar ${hot ? 'hot' : ''}" role="status"><span class="alertbar-text">${hot ? '⚠ ' : ''}${parts.join(' · ')}</span>
    <a class="btn small" href="#/alerts">Review</a><button class="alertbar-x" data-action="alerts-hide" data-sig="${sig}" aria-label="Hide for now">×</button></div>`;
}
actions['alerts-hide'] = (el) => {
  hiddenSig = el.dataset.sig;
  updateChrome();
};

function maybeNotify(a) {
  if (!state.settings.alertNotify || !('Notification' in window) || Notification.permission !== 'granted') return;
  const fresh = [];
  for (const x of a.overdue) {
    if (state.notified[x.e.uid] !== 'overdue') { state.notified[x.e.uid] = 'overdue'; fresh.push(['overdue', x.e]); }
  }
  for (const x of a.soon) {
    if (!state.notified[x.e.uid]) { state.notified[x.e.uid] = 'soon'; fresh.push(['soon', x.e]); }
  }
  if (!fresh.length) return;
  save();
  if (!document.hidden) return; // someone is looking at the page, the banner already shows it
  const late = fresh.filter((f) => f[0] === 'overdue').length;
  const soon = fresh.length - late;
  const summary = [late ? `${late} overdue` : '', soon ? `${soon} due soon` : ''].filter(Boolean).join(', ');
  new Notification('Study Hub', { body: `${summary}: ${displayTitle(fresh[0][1].title)}${fresh.length > 1 ? ' and more' : ''}`, tag: 'study-hub-alerts' });
}

// Refresh everything that lives outside the page content. Cheap, so it runs after every render and once a minute.
export function updateChrome() {
  const a = currentAlerts();
  const badge = document.getElementById('nav-todo');
  if (badge) {
    badge.textContent = a.count ? String(a.count) : '';
    badge.hidden = !a.count;
  }
  const bar = document.getElementById('alertbar');
  if (bar) bar.innerHTML = bannerHtml(a);
  const chip = document.getElementById('sync-chip');
  if (chip) {
    const cls = syncStatus.busy ? 'busy' : syncStatus.error ? 'err' : 'ok';
    chip.innerHTML = canSync() ? `<button class="chip-sync ${cls}" data-action="sync-bg" title="Sync from Toddle now"><i class="dot"></i>${esc(syncText())}</button>` : '';
  }
  const line = document.getElementById('sync-line');
  if (line) line.outerHTML = syncLineHtml();
  maybeNotify(a);
}
