// Task details in a side panel (full-screen sheet on small screens) instead of expanding rows inline.
import { state, kindOf, isDone, classInfo, classTeachers, setStatus } from './store.js';
import { esc, fmtDate, today, addDays, displayTitle, linkify } from './util.js';
import { isOverdue, dueMs, humanSpan } from './urgency.js';
import { actions, rerender } from './ui.js';
import { tagsFor, dueText, classLabel, resourceButtons, statusSeg } from './components.js';
import { nextLessonOf } from './timetable.js';
import { estOf } from './planner.js';

let openUid = null;
let returnFocus = null;

export const drawerUid = () => openUid;

export function openTask(uid) {
  if (!openUid) returnFocus = document.activeElement;
  openUid = uid;
  renderDrawer();
  document.querySelector('.drawer')?.focus();
}

export function closeTask() {
  if (!openUid) return;
  openUid = null;
  renderDrawer();
  if (returnFocus && document.contains(returnFocus)) returnFocus.focus();
  returnFocus = null;
}

function planBlock(e) {
  const planned = state.plan[e.uid] || '';
  const t = today();
  const days = Array.from({ length: 21 }, (_, i) => addDays(t, i));
  if (planned && !days.includes(planned)) days.unshift(planned);
  const options = ['<option value="">Not planned</option>']
    .concat(days.map((d) => `<option value="${d}" ${d === planned ? 'selected' : ''}>${d === t ? 'Today' : fmtDate(d)}${d > e.date ? ' (after due date)' : ''}</option>`))
    .join('');
  return `<div class="form-row drawer-plan">
    <label class="field">Work on it<select data-change="plan-day" data-uid="${esc(e.uid)}">${options}</select></label>
    <label class="field">Minutes<input type="number" min="5" max="480" step="5" data-change="plan-est" data-uid="${esc(e.uid)}" value="${state.est[e.uid] || ''}" placeholder="${estOf(e.uid)}"></label>
  </div>`;
}

function drawerHtml(e) {
  const c = classInfo(e.classes[0] || '');
  const isTask = e.kind === 'task';
  const material = isTask && kindOf(e) === 'material';
  const done = isDone(e.uid);
  const left = dueMs(e) - Date.now();
  const when = !isTask || material || done ? '' : left < 0 ? `<span class="late">overdue by ${humanSpan(left)}</span>` : `<span class="muted">in ${humanSpan(left)}</span>`;
  const teacher = e.createdBy || (classTeachers(e.classes[0])[0] || '');
  const lesson = isTask ? nextLessonOf(e.classes[0]) : null;
  const decks = state.decks.filter((d) => d.link === e.uid);
  // Skip the description when it only repeats the links shown under Resources (e.g. "Slides: Cell Theory").
  const linkWords = new Set((e.links || []).flatMap((l) => [l.text, l.href]).filter(Boolean));
  const onlyLinks = (e.description || '').split('\n').map((x) => x.trim()).filter(Boolean).every((x) => linkWords.has(x));
  const body = onlyLinks ? '' : e.html || (e.description ? `<p>${linkify(e.description)}</p>` : '');
  return `
  <div class="drawer-backdrop" data-action="drawer-close"></div>
  <aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title" tabindex="-1" style="--c:${isTask ? c.color : 'var(--muted)'}">
    <div class="drawer-band"></div>
    <div class="drawer-top">
      <div>${isTask && e.classes[0] ? classLabel(e.classes[0]) : `<span class="muted small">${esc(e.type)}</span>`}</div>
      <button class="icon-btn" data-action="drawer-close" aria-label="Close">×</button>
    </div>
    <h2 id="drawer-title">${esc(displayTitle(e.title))}</h2>
    <div class="task-meta">${tagsFor(e)}</div>
    <dl class="facts">
      <dt>${isTask ? 'Due' : 'When'}</dt><dd>${esc(dueText(e))} ${when}</dd>
      ${teacher ? `<dt>Set by</dt><dd>${esc(teacher)}</dd>` : ''}
      ${isTask ? `<dt>Type</dt><dd>${esc(e.type)}</dd>` : ''}
      ${lesson ? `<dt>Next lesson</dt><dd>${esc(lesson.label)}</dd>` : ''}
      ${e.location ? `<dt>Where</dt><dd>${esc(e.location)}</dd>` : ''}
    </dl>
    ${isTask ? statusSeg(e) : ''}
    ${material ? '<p class="muted small">Class material: no warnings, not in the planner. Switch to "To do" if you do have to hand something in.</p>' : ''}
    ${(e.links || []).length ? `<h3 class="drawer-h">Resources</h3><div class="res-list">${resourceButtons(e)}</div>` : ''}
    ${body ? `<h3 class="drawer-h">Description</h3><div class="rich">${body}</div>` : isTask && !(e.links || []).length ? '<p class="muted">No description in Toddle.</p>' : ''}
    ${isTask && !material && !done ? `<h3 class="drawer-h">Plan</h3>${planBlock(e)}` : ''}
    <div class="drawer-actions">
      ${e.link ? `<a class="btn primary" href="${esc(e.link)}" target="_blank" rel="noopener noreferrer">Open in Toddle ↗</a>` : ''}
      ${isTask && !material ? `<button class="btn" data-action="plan-focus" data-cls="${esc(e.classes[0] || '')}">Start focus timer</button>` : ''}
      ${decks.map((d) => `<a class="btn" href="#/flashcards/${d.id}">Study cards: ${esc(d.name)}</a>`).join('')}
    </div>
  </aside>`;
}

export function renderDrawer() {
  const host = document.getElementById('drawer');
  if (!host) return;
  const e = openUid && state.events.find((x) => x.uid === openUid);
  if (!e) {
    openUid = null;
    host.innerHTML = '';
    document.body.classList.remove('drawer-open');
    return;
  }
  const prev = host.querySelector('.drawer');
  const scroll = prev ? prev.scrollTop : 0;
  const hadFocus = prev && prev.contains(document.activeElement) ? document.activeElement.dataset.change || document.activeElement.dataset.s : null;
  host.innerHTML = drawerHtml(e);
  document.body.classList.add('drawer-open');
  const now = host.querySelector('.drawer');
  now.scrollTop = scroll;
  if (prev) {
    const again = hadFocus && host.querySelector(`[data-change="${hadFocus}"], [data-s="${hadFocus}"]`);
    (again || now).focus({ preventScroll: true });
  }
}

actions['open-task'] = (el) => openTask(el.dataset.uid);
actions['drawer-close'] = () => closeTask();
actions['set-status'] = (el) => {
  setStatus(el.dataset.uid, el.dataset.s);
  rerender();
};

document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape' && openUid && !document.querySelector('dialog[open]')) closeTask();
  // keep Tab inside the panel while it is open
  if (ev.key === 'Tab' && openUid) {
    const panel = document.querySelector('.drawer');
    const items = panel ? [...panel.querySelectorAll('a[href], button, select, input, [tabindex="0"]')].filter((x) => !x.disabled) : [];
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (ev.shiftKey && (document.activeElement === first || document.activeElement === panel)) { last.focus(); ev.preventDefault(); }
    else if (!ev.shiftKey && document.activeElement === last) { first.focus(); ev.preventDefault(); }
  }
});
window.addEventListener('hashchange', () => openUid && closeTask());
