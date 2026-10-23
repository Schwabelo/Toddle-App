// Reusable HTML fragments.
import { state, isDone, classInfo } from './store.js';
import { esc, today, fmtDate, fmtTime, relDay, linkify, displayTitle } from './util.js';

export const isHomework = (e) => /^🏠/.test(e.title) || /\b(home ?learning|homework|HML)\b/i.test(e.title);

// Only tags that tell you something: "Learning" is the default and stays untagged.
export function tagsFor(e) {
  if (e.kind !== 'task') return e.type === 'Holidays and vacations' ? '' : `<span class="tag">${esc(e.type)}</span>`;
  const map = {
    'Summative Assessment': ['t-summ', 'Summative'],
    'Formative Assessment': ['t-form', 'Formative'],
    'Quick Task': ['t-quick', 'Quick task'],
  };
  const m = map[e.type];
  return (m ? `<span class="tag ${m[0]}">${m[1]}</span>` : '') + (isHomework(e) ? '<span class="tag">Homework</span>' : '');
}

export function dueText(e, timeOnly = false) {
  if (timeOnly) return e.allDay ? 'All day' : fmtTime(e.time, state.settings.time24);
  const when = e.allDay ? '' : ' · ' + fmtTime(e.time, state.settings.time24);
  const range = e.endDate !== e.date ? ` – ${fmtDate(e.endDate)}` : '';
  return `${fmtDate(e.date)}${range}${when}`;
}

export function classLabel(full) {
  const c = classInfo(full);
  return `<a class="class-label" href="#/class/${encodeURIComponent(full)}"><i class="dot" style="--c:${c.color}"></i>${esc(c.name)}</a>`;
}

export function taskRow(e, { showClass = true, showRel = false, timeOnly = false } = {}) {
  const done = isDone(e.uid);
  const overdue = !done && e.date < today();
  return `
  <div class="trow ${done ? 'is-done' : ''}">
    <button class="check" data-action="toggle" data-uid="${esc(e.uid)}" aria-pressed="${done}" aria-label="${done ? 'Mark as not done' : 'Mark as done'}">${done ? '✓' : ''}</button>
    <details class="task-main" data-keep="${esc(e.uid)}">
      <summary>
        <span class="task-title">${esc(displayTitle(e.title))}</span>
        <span class="task-meta">
          ${tagsFor(e)}
          <span class="due ${overdue ? 'late' : ''}">${esc(dueText(e, timeOnly))}</span>
          ${showRel && !done ? `<span>${esc(relDay(e.date))}</span>` : ''}
          ${showClass ? e.classes.map(classLabel).join('') : ''}
        </span>
      </summary>
      <div class="task-detail">
        ${e.description ? `<p class="desc">${linkify(e.description)}</p>` : '<p class="muted">No description.</p>'}
        ${e.createdBy ? `<p class="muted small">Set by ${esc(e.createdBy)}</p>` : ''}
        <div class="row">
          ${e.link ? `<a class="btn small" href="${esc(e.link)}" target="_blank" rel="noopener noreferrer">Open in Toddle ↗</a>` : ''}
          ${state.decks.filter((d) => d.link === e.uid).map((d) => `<a class="btn small" href="#/flashcards/${d.id}">Study cards: ${esc(d.name)}</a>`).join('')}
        </div>
      </div>
    </details>
  </div>`;
}

export function eventRow(e) {
  return `
  <div class="trow event-row">
    <span class="ev-dot"></span>
    <div class="task-main"><div class="task-title">${esc(displayTitle(e.title))}</div>
      <div class="task-meta">${tagsFor(e)}<span class="due">${esc(dueText(e))}</span>${e.location ? `<span>${esc(e.location)}</span>` : ''}</div>
    </div>
  </div>`;
}

export const emptyState = (icon, title, text, action = '') =>
  `<div class="empty"><div class="empty-icon">${icon}</div><h3>${esc(title)}</h3><p>${text}</p>${action}</div>`;

export const bar = (parts) =>
  `<div class="bar">${parts.filter((p) => p.v > 0).map((p) => `<span style="width:${p.v}%;background:${p.c}" title="${esc(p.t || '')}"></span>`).join('')}</div>`;
