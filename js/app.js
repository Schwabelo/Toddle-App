// Router, shell and event delegation.
import { state } from './store.js';
import { actions, changes, inputs, setRender } from './ui.js';
import { startPage, classesPage, classPage, progressPage, settingsPage, schedulePage, applyTheme } from './pages.js';
import { calendarPage } from './calendar.js';
import { todoPage, catchupPage } from './todo.js';
import { renderDrawer, openTask } from './drawer.js';
import { timerPage, updateTimerUI } from './timer.js';
import { cardsPage } from './cards.js';
import { plannerPage } from './planner.js';
import { alertsPage, updateChrome } from './alerts.js';
import { backgroundSync } from './sync.js';

const view = document.getElementById('view');

const ROUTES = {
  '': { nav: 'start', page: startPage },
  alerts: { nav: 'todo', page: alertsPage },
  todo: { nav: 'todo', page: todoPage },
  catchup: { nav: 'todo', page: catchupPage },
  classes: { nav: 'classes', page: classesPage },
  class: { nav: 'classes', page: (a, b) => classPage(decodeURIComponent(a), b ? decodeURIComponent(b) : '') },
  calendar: { nav: 'calendar', page: calendarPage },
  planner: { nav: 'planner', page: plannerPage },
  schedule: { nav: 'schedule', page: schedulePage },
  timer: { nav: 'timer', page: timerPage },
  flashcards: { nav: 'flashcards', page: cardsPage },
  progress: { nav: 'progress', page: progressPage },
  settings: { nav: 'settings', page: (a) => settingsPage(a) },
};

function route() {
  const [name = '', a, b] = location.hash.replace(/^#\/?/, '').split('/');
  return { r: ROUTES[name] || ROUTES[''], a, b, name };
}

let freshNav = true; // true until the first render after a navigation, so a deep link can scroll to its target

function render() {
  const { r, a, b, name } = route();
  // Re-rendering would reload the scheduler frame and lose unsaved edits (e.g. when the timer ends).
  if (r.nav === 'schedule' && view.querySelector('.sched-frame')) {
    updateChrome();
    renderDrawer();
    return;
  }
  // Keep expanded assignment details and scroll position across re-renders.
  const open = new Set([...view.querySelectorAll('details[open][data-keep]')].map((d) => d.dataset.keep));
  const y = window.scrollY;
  view.innerHTML = r.page(a, b);
  const frame = view.querySelector('iframe[data-srcdoc]');
  if (frame) frame.srcdoc = window.SCHEDULER_SRCDOC;
  view.querySelectorAll('details[data-keep]').forEach((d) => open.has(d.dataset.keep) && (d.open = true));
  window.scrollTo(0, y);
  if (freshNav) {
    const target = view.querySelector('[data-focus]');
    if (target) target.scrollIntoView({ block: 'center' });
    // a link to a task inside a class (#/class/<class>/<uid>) also opens its details
    if (name === 'class' && b) openTask(decodeURIComponent(b));
    freshNav = false;
  }
  renderDrawer();
  document.querySelectorAll('[data-nav]').forEach((el) => el.classList.toggle('active', el.dataset.nav === r.nav));
  updateTimerUI();
  updateChrome();
}

setRender(render);

window.addEventListener('hashchange', () => {
  if (location.hash && !location.hash.startsWith('#/')) return; // e.g. the skip link
  window.scrollTo(0, 0);
  freshNav = true;
  render();
});

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  const fn = actions[el.dataset.action];
  if (fn) fn(el, e);
});
document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-change]');
  if (el && changes[el.dataset.change]) changes[el.dataset.change](el, e);
});
document.addEventListener('input', (e) => {
  const el = e.target.closest('[data-input]');
  if (el && inputs[el.dataset.input]) inputs[el.dataset.input](el, e);
});

applyTheme();
render();

// ---- background sync and warnings ----
const typing = () => /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '');

async function sync(reason) {
  const before = backgroundSync(reason); // runs the request; the chip shows "Syncing…" meanwhile
  updateChrome();
  const result = await before;
  updateChrome();
  // Only redraw when something changed, and never while someone is typing (it would wipe their text).
  if (result && result.changed && !typing()) render();
}

sync('open');
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) sync('focus');
});
setInterval(() => sync('timer'), 30 * 60e3);
setInterval(updateChrome, 60e3); // warnings change as time passes, even without a sync

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
