// Reusable HTML fragments.
import { state, isDone, classInfo, classColor } from './store.js';
import { esc, today, fmtDate, fmtTime, relDay, linkify } from './util.js';

export const isHomework = (e) => /^🏠/.test(e.title) || /\b(home ?learning|homework|HML)\b/i.test(e.title);

export function typeBadge(e) {
  if (e.kind !== 'task') return `<span class="badge b-event">${esc(e.type)}</span>`;
  const map = {
    'Summative Assessment': ['b-summ', 'Summative'],
    'Formative Assessment': ['b-form', 'Formative'],
    'Quick Task': ['b-quick', 'Quick task'],
    'Learning Experience': ['b-learn', 'Learning'],
  };
  const [cls, label] = map[e.type] || ['b-learn', e.type];
  return `<span class="badge ${cls}">${esc(label)}</span>${isHomework(e) ? '<span class="badge b-home">Homework</span>' : ''}`;
}

export function dueText(e) {
  const when = e.allDay ? '' : ' · ' + fmtTime(e.time, state.settings.time24);
  const range = e.endDate !== e.date ? ` – ${fmtDate(e.endDate)}` : '';
  return `${fmtDate(e.date)}${range}${when}`;
}

export function classChip(full) {
  const c = classInfo(full);
  return `<a class="class-chip" href="#/class/${encodeURIComponent(full)}" style="--c:${c.color}">${esc(c.name)}</a>`;
}

export function taskRow(e, { showClass = true } = {}) {
  const done = isDone(e.uid);
  const overdue = !done && e.date < today();
  const color = classColor(e.classes[0]);
  const rel = done ? 'Done' : relDay(e.date);
  return `
  <div class="task ${done ? 'is-done' : ''} ${overdue ? 'is-overdue' : ''}" style="--c:${color}">
    <button class="check" data-action="toggle" data-uid="${esc(e.uid)}" aria-pressed="${done}" aria-label="${done ? 'Mark as not done' : 'Mark as done'}">${done ? '✓' : ''}</button>
    <details class="task-main" data-keep="${esc(e.uid)}">
      <summary>
        <span class="task-title">${esc(e.title)}</span>
        <span class="task-meta">
          ${typeBadge(e)}
          <span class="due ${overdue ? 'late' : ''}">${esc(dueText(e))} <em>(${esc(rel)})</em></span>
          ${showClass ? e.classes.map(classChip).join('') : ''}
        </span>
      </summary>
      <div class="task-detail">
        ${e.description ? `<p class="desc">${linkify(e.description)}</p>` : '<p class="muted">No description.</p>'}
        <p class="muted small">${e.createdBy ? 'By ' + esc(e.createdBy) : ''}</p>
        ${e.link ? `<a class="btn small" href="${esc(e.link)}" target="_blank" rel="noopener noreferrer">Open in Toddle ↗</a>` : ''}
      </div>
    </details>
  </div>`;
}

export function eventRow(e) {
  return `
  <div class="task event-row">
    <span class="dot-ev"></span>
    <div class="task-main"><div class="task-title">${esc(e.title)}</div>
      <div class="task-meta">${typeBadge(e)} <span class="due">${esc(dueText(e))}</span>${e.location ? ` <span class="muted">📍 ${esc(e.location)}</span>` : ''}</div>
    </div>
  </div>`;
}

export const emptyState = (icon, title, text, action = '') =>
  `<div class="empty"><div class="empty-icon">${icon}</div><h3>${esc(title)}</h3><p>${text}</p>${action}</div>`;

export const bar = (parts) =>
  `<div class="bar">${parts.filter((p) => p.v > 0).map((p) => `<span style="width:${p.v}%;background:${p.c}" title="${esc(p.t || '')}"></span>`).join('')}</div>`;
