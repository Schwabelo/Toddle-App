// Focus timer (Pomodoro). Lives at module level so it keeps running while you browse other pages.
import { state, save, classNames, classInfo, studyMinutesOn } from './store.js';
import { esc, today, pad } from './util.js';
import { actions, changes, rerender, toast } from './ui.js';

const MODES = { focus: 'Focus', short: 'Short break', long: 'Long break' };
const timer = { mode: 'focus', running: false, endsAt: 0, remaining: 0, cls: '', cycles: 0 };
let tick = null;

const total = (mode = timer.mode) =>
  60 * (mode === 'focus' ? state.settings.focusMin : mode === 'short' ? state.settings.shortMin : state.settings.longMin);

timer.remaining = total();

export function focusOn(cls) {
  timer.cls = cls || '';
}

export function syncDurations() {
  if (!timer.running) timer.remaining = total();
}

const fmt = (s) => `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;

function beep() {
  if (!state.settings.sound) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.25, 0.5].forEach((t) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.2, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.2);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.22);
    });
  } catch (e) { /* audio not available */ }
}

export function updateTimerUI() {
  const label = fmt(timer.remaining);
  const disp = document.getElementById('timer-display');
  if (disp) disp.textContent = label;
  const ring = document.getElementById('timer-ring');
  if (ring) {
    const r = 108;
    const c = 2 * Math.PI * r;
    ring.style.strokeDasharray = c;
    ring.style.strokeDashoffset = c * (1 - timer.remaining / total());
  }
  const nav = document.getElementById('nav-timer');
  if (nav) nav.textContent = timer.running ? label : '';
  document.title = timer.running ? `${label} · ${MODES[timer.mode]}` : 'Toddle Study Hub';
}

function stopTicking() {
  clearInterval(tick);
  tick = null;
  timer.running = false;
}

function onTick() {
  timer.remaining = Math.max(0, Math.ceil((timer.endsAt - Date.now()) / 1000));
  updateTimerUI();
  if (timer.remaining <= 0) complete();
}

function complete() {
  stopTicking();
  beep();
  const was = timer.mode;
  if (was === 'focus') {
    state.sessions.push({ date: today(), minutes: state.settings.focusMin, cls: timer.cls });
    save();
    timer.cycles++;
    toast(`Focus session done — ${state.settings.focusMin} min logged 🎉`);
  } else {
    toast('Break over. Ready for another round?');
  }
  if (state.settings.notify && 'Notification' in window && Notification.permission === 'granted') {
    new Notification(was === 'focus' ? 'Focus session complete' : 'Break is over');
  }
  setMode(was === 'focus' ? (timer.cycles % state.settings.longEvery === 0 ? 'long' : 'short') : 'focus');
}

function setMode(mode) {
  stopTicking();
  timer.mode = mode;
  timer.remaining = total();
  updateTimerUI();
  rerender();
}

actions['timer-toggle'] = () => {
  if (timer.running) {
    timer.remaining = Math.max(0, Math.ceil((timer.endsAt - Date.now()) / 1000));
    stopTicking();
  } else {
    timer.running = true;
    timer.endsAt = Date.now() + timer.remaining * 1000;
    tick = setInterval(onTick, 250);
    if (state.settings.notify && 'Notification' in window && Notification.permission === 'default') Notification.requestPermission();
  }
  updateTimerUI();
  rerender();
};
actions['timer-reset'] = () => setMode(timer.mode);
actions['timer-mode'] = (el) => setMode(el.dataset.mode);
actions['timer-skip'] = () => setMode(timer.mode === 'focus' ? 'short' : 'focus');
changes['timer-class'] = (el) => {
  timer.cls = el.value;
};

export function timerPage() {
  const t = today();
  const todays = state.sessions.filter((s) => s.date === t);
  const opts = classNames()
    .map((c) => `<option value="${esc(c)}" ${timer.cls === c ? 'selected' : ''}>${esc(classInfo(c).name)}</option>`)
    .join('');
  return `
  <h1>Focus timer</h1>
  <div class="timer-wrap card">
    <div class="tabs" role="tablist">
      ${Object.entries(MODES).map(([k, v]) => `<button class="tab ${timer.mode === k ? 'active' : ''}" data-action="timer-mode" data-mode="${k}" role="tab">${v}</button>`).join('')}
    </div>
    <div class="ring-box">
      <svg viewBox="0 0 240 240" class="ring" aria-hidden="true">
        <circle cx="120" cy="120" r="108" class="ring-bg"/>
        <circle id="timer-ring" cx="120" cy="120" r="108" class="ring-fg" transform="rotate(-90 120 120)"/>
      </svg>
      <div class="ring-text"><div id="timer-display" class="time-big">${fmt(timer.remaining)}</div><div class="muted">${MODES[timer.mode]}</div></div>
    </div>
    <div class="row center">
      <button class="btn primary big" data-action="timer-toggle">${timer.running ? 'Pause' : timer.remaining < total() ? 'Resume' : 'Start'}</button>
      <button class="btn" data-action="timer-reset">Reset</button>
      <button class="btn" data-action="timer-skip">Skip</button>
    </div>
    <label class="field center-field">Studying for
      <select data-change="timer-class"><option value="">General</option>${opts}</select>
    </label>
  </div>
  <div class="grid stats">
    <div class="card stat"><div class="stat-num">${todays.length}</div><div class="muted">sessions today</div></div>
    <div class="card stat"><div class="stat-num">${studyMinutesOn(t)}</div><div class="muted">minutes today</div></div>
    <div class="card stat"><div class="stat-num">${timer.cycles}</div><div class="muted">in this sitting</div></div>
  </div>
  <p class="muted small">Only finished focus sessions are logged. Durations and sound are in <a href="#/settings">Settings</a>. Keep this tab open while the timer runs.</p>`;
}

export function timerMounted() {
  updateTimerUI();
}
