// Router, shell and event delegation.
import { state, save } from './store.js';
import { actions, changes, inputs, setRender } from './ui.js';
import { startPage, classesPage, classPage, calendarPage, progressPage, settingsPage, schedulePage, applyTheme } from './pages.js';
import { timerPage, updateTimerUI } from './timer.js';
import { cardsPage } from './cards.js';
import { plannerPage } from './planner.js';
import { syncFromFeed, getProxy } from './sync.js';

const view = document.getElementById('view');

const ROUTES = {
  '': { nav: 'start', page: startPage },
  classes: { nav: 'classes', page: classesPage },
  class: { nav: 'classes', page: (a) => classPage(decodeURIComponent(a)) },
  calendar: { nav: 'calendar', page: calendarPage },
  planner: { nav: 'planner', page: plannerPage },
  schedule: { nav: 'schedule', page: schedulePage },
  timer: { nav: 'timer', page: timerPage },
  flashcards: { nav: 'flashcards', page: cardsPage },
  progress: { nav: 'progress', page: progressPage },
  settings: { nav: 'settings', page: settingsPage },
};

function route() {
  const [name = '', arg] = location.hash.replace(/^#\/?/, '').split('/');
  return { r: ROUTES[name] || ROUTES[''], arg };
}

function render() {
  const { r, arg } = route();
  // Re-rendering would reload the scheduler frame and lose unsaved edits (e.g. when the timer ends).
  if (r.nav === 'schedule' && view.querySelector('.sched-frame')) return;
  // Keep expanded assignment details and scroll position across re-renders.
  const open = new Set([...view.querySelectorAll('details[open][data-keep]')].map((d) => d.dataset.keep));
  const y = window.scrollY;
  view.innerHTML = r.page(arg);
  const frame = view.querySelector('iframe[data-srcdoc]');
  if (frame) frame.srcdoc = window.SCHEDULER_SRCDOC;
  view.querySelectorAll('details[data-keep]').forEach((d) => open.has(d.dataset.keep) && (d.open = true));
  window.scrollTo(0, y);
  document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === r.nav));
  updateTimerUI();
}

setRender(render);

window.addEventListener('hashchange', () => {
  window.scrollTo(0, 0);
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

// Quietly refresh from Toddle when a proxy is configured (direct downloads are blocked by Toddle's CORS rules).
if (state.feedUrl && getProxy() && (!state.lastSync || Date.now() - state.lastSync > 3600e3)) {
  syncFromFeed().then(render).catch(() => {});
}

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
