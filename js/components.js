// Reusable HTML fragments.
import { state, isDone, classInfo, kindOf, statusOf } from './store.js';
import { esc, fmtDate, fmtTime, relDay, displayTitle } from './util.js';
import { isOverdue, dueClock, isAssessment } from './urgency.js';
import { criteriaOf, resourceOf, isHomeworkTitle } from './enrich.js';

export const isHomework = (e) => isHomeworkTitle(e.title);
export const isSummative = (e) => e.type === 'Summative Assessment';

export const criteriaChips = (e) =>
  criteriaOf(e.title).map((c) => `<span class="crit crit-${c}" title="MYP criterion ${c}">${c}</span>`).join('');

// Only tags that tell you something: "Learning" is the default and stays untagged.
export function tagsFor(e) {
  if (e.kind !== 'task') return e.type === 'Holidays and vacations' ? '<span class="tag">Day off</span>' : `<span class="tag">${esc(e.type)}</span>`;
  const map = {
    'Summative Assessment': ['t-summ', 'Summative'],
    'Formative Assessment': ['t-form', 'Formative'],
    'Quick Task': ['t-quick', 'Quick task'],
  };
  const m = map[e.type];
  return (m ? `<span class="tag ${m[0]}">${m[1]}</span>` : '')
    + (isHomework(e) ? '<span class="tag">Homework</span>' : '')
    + (kindOf(e) === 'material' ? '<span class="tag t-mat">Class material</span>' : '')
    + criteriaChips(e);
}

export function dueText(e, timeOnly = false) {
  const clock = dueClock(e);
  if (timeOnly) return e.allDay ? 'All day' : fmtTime(clock, state.settings.time24);
  const when = e.allDay ? '' : ' · ' + fmtTime(clock, state.settings.time24);
  const range = e.endDate !== e.date ? ` – ${fmtDate(e.endDate)}` : '';
  return `${fmtDate(e.date)}${range}${when}`;
}

export function classLabel(full, link = true) {
  const c = classInfo(full);
  const inner = `<i class="dot" style="--c:${c.color}"></i>${esc(c.name)}`;
  return link ? `<a class="class-label" href="#/class/${encodeURIComponent(full)}">${inner}</a>` : `<span class="class-label">${inner}</span>`;
}

// ---- resources (Google Slides, Forms, Edpuzzle, IXL …) ----
const RES_ICON = {
  slides: '<rect x="3.5" y="5" width="17" height="12" rx="2"/><path d="M12 17v3M8.5 20h7"/>',
  doc: '<path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10A.5.5 0 0 1 7 20z"/><path d="M14 3.5V8h4M9.5 12h6M9.5 15.5h6"/>',
  sheet: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 10h16M4 15h16M10 4v16"/>',
  form: '<rect x="5" y="3.5" width="14" height="17" rx="2"/><path d="M8.5 9h7M8.5 13h7M8.5 17h4"/>',
  drive: '<path d="M8.5 4h7l5 8.5-3.5 6h-10l-3.5-6z"/><path d="M8.5 4l5 8.5h7M3.5 12.5h10l-3.5 6"/>',
  video: '<rect x="3.5" y="6" width="12.5" height="12" rx="2"/><path d="M16 10.5 20.5 8v8L16 13.5"/>',
  practice: '<path d="M5 12.5 9.5 17 19 7.5"/>',
  design: '<circle cx="12" cy="12" r="8.5"/><circle cx="9" cy="10" r="1"/><circle cx="14.5" cy="9" r="1"/><path d="M12 20.5a2.5 2.5 0 0 1 0-5h2"/>',
  board: '<rect x="3.5" y="4" width="17" height="16" rx="2"/><path d="M8 8v8M12 8v5M16 8v6"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1"/><path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1"/>',
};
export const icon = (paths, cls = 'ico') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;

export function resourceButtons(e, compact = false) {
  return (e.links || []).map((l) => {
    const r = resourceOf(l);
    const text = r.text && r.text.length < 70 ? r.text : r.label;
    return `<a class="res res-${r.kind}" href="${esc(r.href)}" target="_blank" rel="noopener noreferrer" title="${esc(r.label)}: ${esc(r.href)}">${icon(RES_ICON[r.kind] || RES_ICON.link)}${compact ? '' : `<span><b>${esc(r.label)}</b>${text !== r.label ? `<small>${esc(text)}</small>` : ''}</span>`}</a>`;
  }).join('');
}

// To do / Done / Not homework
export function statusSeg(e) {
  const s = statusOf(e);
  const b = (k, label) => `<button class="seg-btn ${s === k ? 'on' : ''}" data-action="set-status" data-uid="${esc(e.uid)}" data-s="${k}" aria-pressed="${s === k}">${label}</button>`;
  return `<div class="seg" role="group" aria-label="Status">${b('todo', 'To do')}${b('done', 'Done')}${b('material', 'Not homework')}</div>`;
}

const MAT_ICON = icon('<path d="M5 4.5h10.5A2.5 2.5 0 0 1 18 7v13H7.5A2.5 2.5 0 0 1 5 17.5z"/><path d="M5 17.5A2.5 2.5 0 0 1 7.5 15H18"/>', 'ico mat-ico');

export function taskRow(e, { showClass = true, showRel = false, timeOnly = false, focus = false } = {}) {
  const done = isDone(e.uid);
  const material = kindOf(e) === 'material';
  const overdue = !done && !material && isOverdue(e);
  const lead = material
    ? `<span class="mat-lead" title="Class material: nothing to hand in">${MAT_ICON}</span>`
    : `<button class="check" data-action="toggle" data-uid="${esc(e.uid)}" aria-pressed="${done}" aria-label="${done ? 'Mark as not done' : 'Mark as done'}">${done ? '✓' : ''}</button>`;
  return `
  <div class="trow ${done ? 'is-done' : ''} ${material ? 'is-mat' : ''} ${focus ? 'flash' : ''}" ${focus ? 'data-focus="1"' : ''}>
    ${lead}
    <button class="task-main task-open" data-action="open-task" data-uid="${esc(e.uid)}">
      <span class="task-title">${esc(displayTitle(e.title))}</span>
      <span class="task-meta">
        ${tagsFor(e)}
        <span class="due ${overdue ? 'late' : ''}">${esc(dueText(e, timeOnly))}</span>
        ${showRel && !done && !material ? `<span>${esc(relDay(e.date))}</span>` : ''}
        ${showClass ? e.classes.map((c) => classLabel(c, false)).join('') : ''}
        ${(e.links || []).length ? `<span class="res-count" title="Has links">${icon(RES_ICON.link)}${e.links.length}</span>` : ''}
      </span>
    </button>
  </div>`;
}

export function eventRow(e) {
  return `
  <div class="trow event-row">
    <span class="ev-dot ${e.type === 'Holidays and vacations' ? 'off' : ''}"></span>
    <div class="task-main"><div class="task-title">${esc(displayTitle(e.title))}</div>
      <div class="task-meta">${tagsFor(e)}<span class="due">${esc(dueText(e))}</span>${e.location ? `<span>${esc(e.location)}</span>` : ''}</div>
    </div>
  </div>`;
}

export const emptyState = (icon, title, text, action = '') =>
  `<div class="empty"><div class="empty-icon">${icon}</div><h3>${esc(title)}</h3><p>${text}</p>${action}</div>`;

export const bar = (parts) =>
  `<div class="bar">${parts.filter((p) => p.v > 0).map((p) => `<span style="width:${p.v}%;background:${p.c}" title="${esc(p.t || '')}"></span>`).join('')}</div>`;

// Subject icon for class banners, guessed from the class name.
const SUBJECTS = [
  [/math/i, '➗'], [/scien|bio|chem|phys/i, '🔬'], [/english/i, '📖'], [/german|deutsch|spanish|español|french|acquisition/i, '💬'],
  [/lang|lit/i, '📚'], [/art|music|drama|theat/i, '🎨'], [/design|tech/i, '📐'], [/phe|physical|sport|health/i, '⚽'],
  [/individuals|societ|history|geog|humanit/i, '🌍'], [/comput|ict|coding/i, '💻'],
];
export const subjectIcon = (name) => (SUBJECTS.find(([re]) => re.test(name)) || [null, '📘'])[1];
