// Flashcards: decks, spaced repetition, and three ways to study (flip, type the answer, multiple choice).
import { state, save, classNames, classInfo, tasks, isDone } from './store.js';
import { esc, today, addDays, uid, download, fmtDate, displayTitle } from './util.js';
import { actions, changes, inputs, rerender, toast } from './ui.js';
import { emptyState } from './components.js';
import { norm, judge, parseBulk } from './textmatch.js';

const INTERVALS = [0, 1, 3, 7, 14, 30, 60];
const MASTERED_BOX = 4; // a card reviewed correctly often enough to be 14+ days away
const STUDY_MODES = { flip: 'Flip cards', type: 'Type the answer', mc: 'Multiple choice' };
const DIRS = { f: 'Front → back', b: 'Back → front', both: 'Both ways' };
const SEPS = { auto: 'Detect automatically', tab: 'Tab', semi: 'Semicolon ;', comma: 'Comma ,', dash: 'Spaced dash -', colon: 'Colon :' };

let study = null; // the study session in progress, see studyGo()
let bulkSep = 'auto';

// ---- helpers ----
const deckById = (id) => state.decks.find((d) => d.id === id);
const dueCards = (d) => d.cards.filter((c) => c.due <= today());
const prefsOf = (d) => ({ mode: 'flip', dir: 'f', scope: 'due', ...(d.prefs || {}) });
const newCard = (front, back) => ({ id: uid(), front, back, box: 0, due: today(), seen: 0, miss: 0 });
const missRate = (c) => ((c.seen || 0) ? (c.miss || 0) / c.seen : 0);
const weakCards = (d) =>
  d.cards.filter((c) => (c.miss || 0) > 0).sort((a, b) => missRate(b) - missRate(a) || b.miss - a.miss).slice(0, 20);
const masteredCount = (d) => d.cards.filter((c) => c.box >= MASTERED_BOX).length;
const askText = (c, dir) => (dir === 'f' ? c.front : c.back);
const answerText = (c, dir) => (dir === 'f' ? c.back : c.front);
const shuffle = (arr) => arr.map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((p) => p[1]);

export const dueCardCount = () => state.decks.reduce((a, d) => a + dueCards(d).length, 0);

// ---- deck and card management ----
function renderPreview(ta) {
  const box = document.getElementById(ta.dataset.prev);
  if (!box) return;
  if (!ta.value.trim()) {
    box.innerHTML = '';
    return;
  }
  const { cards, skipped } = parseBulk(ta.value, bulkSep);
  const rows = cards.slice(0, 4).map((c) => `<div class="prev-row"><span>${esc(c.front)}</span><span class="muted">${esc(c.back)}</span></div>`).join('');
  box.innerHTML = `<p class="muted small">${cards.length} card${cards.length === 1 ? '' : 's'} found${skipped ? `, ${skipped} line${skipped === 1 ? '' : 's'} skipped (no separator)` : ''}.</p>${rows}${cards.length > 4 ? `<p class="muted small">…and ${cards.length - 4} more</p>` : ''}`;
}
inputs['bulk-preview'] = (el) => renderPreview(el);
changes['bulk-sep'] = (el) => {
  bulkSep = el.value;
  document.querySelectorAll('[data-input="bulk-preview"]').forEach(renderPreview);
};

actions['deck-create'] = () => {
  const name = document.getElementById('deck-name').value.trim();
  if (!name) return toast('Give the deck a name first.');
  const cls = document.getElementById('deck-class').value;
  const cards = parseBulk(document.getElementById('deck-bulk').value, bulkSep).cards.map((c) => newCard(c.front, c.back));
  const deck = { id: uid(), name, cls, cards, created: today() };
  state.decks.unshift(deck);
  save();
  location.hash = `#/flashcards/${deck.id}`;
};
actions['deck-delete'] = (el) => {
  const d = deckById(el.dataset.id);
  if (d && confirm(`Delete "${d.name}" and its ${d.cards.length} cards?`)) {
    state.decks = state.decks.filter((x) => x.id !== d.id);
    save();
    study = null;
    location.hash = '#/flashcards';
  }
};
actions['card-add'] = (el) => {
  const d = deckById(el.dataset.id);
  const f = document.getElementById('card-front');
  const b = document.getElementById('card-back');
  if (!f.value.trim() || !b.value.trim()) return toast('Both sides need some text.');
  d.cards.push(newCard(f.value.trim(), b.value.trim()));
  save();
  rerender();
  document.getElementById('card-front').focus();
};
actions['card-bulk'] = (el) => {
  const d = deckById(el.dataset.id);
  const { cards } = parseBulk(document.getElementById('bulk-text').value, bulkSep);
  if (!cards.length) return toast('No cards found. Use one per line: term ; definition');
  cards.forEach((c) => d.cards.push(newCard(c.front, c.back)));
  save();
  toast(`Added ${cards.length} cards`);
  rerender();
};
actions['card-delete'] = (el) => {
  const d = deckById(el.dataset.id);
  d.cards = d.cards.filter((c) => c.id !== el.dataset.card);
  save();
  rerender();
};
actions['card-edit'] = (el) => {
  const d = deckById(el.dataset.id);
  const c = d.cards.find((x) => x.id === el.dataset.card);
  const front = prompt('Front', c.front);
  if (front === null) return;
  const back = prompt('Back', c.back);
  if (back === null) return;
  if (front.trim() && back.trim()) {
    c.front = front.trim();
    c.back = back.trim();
    save();
    rerender();
  }
};
actions['deck-export'] = (el) => {
  const d = deckById(el.dataset.id);
  download(`${d.name.replace(/[^\w-]+/g, '_')}.json`, JSON.stringify({ name: d.name, cards: d.cards.map(({ front, back }) => ({ front, back })) }, null, 2));
};
changes['deck-import'] = async (el) => {
  const file = el.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const cards = (data.cards || []).filter((c) => c.front && c.back).map((c) => newCard(String(c.front), String(c.back)));
    if (!cards.length) throw new Error('empty');
    state.decks.unshift({ id: uid(), name: data.name || file.name.replace(/\.json$/, ''), cls: '', cards, created: today() });
    save();
    toast(`Imported ${cards.length} cards`);
    rerender();
  } catch (e) {
    toast('That file is not a deck exported from this app.');
  }
  el.value = '';
};
changes['deck-pref'] = (el) => {
  const d = deckById(el.dataset.id);
  d.prefs = { ...prefsOf(d), [el.dataset.key]: el.value };
  save();
};
changes['deck-link'] = (el) => {
  const d = deckById(el.dataset.id);
  if (el.value) d.link = el.value;
  else delete d.link;
  save();
};

// ---- studying ----
const cardMode = () => (study.mode === 'mc' && study.options.length < 2 ? 'flip' : study.mode);
const currentCard = () => {
  const item = study.queue[0];
  return { item, card: deckById(study.deckId).cards.find((c) => c.id === item.id) };
};

function prepare() {
  if (!study || !study.queue.length) return;
  study.flipped = false;
  study.phase = 'ask';
  study.result = null;
  study.picked = null;
  study.options = [];
  if (study.mode === 'mc') {
    const { item, card } = currentCard();
    const right = answerText(card, item.dir);
    const seen = new Set([norm(right)]);
    const wrong = [];
    for (const other of shuffle(deckById(study.deckId).cards.filter((c) => c.id !== card.id))) {
      const text = answerText(other, item.dir);
      if (!seen.has(norm(text))) {
        seen.add(norm(text));
        wrong.push(text);
      }
      if (wrong.length === 3) break;
    }
    study.options = shuffle([right, ...wrong]);
    study.rightIndex = study.options.indexOf(right);
  }
}

const focusAnswer = () => document.getElementById('type-answer')?.focus();

actions['study-go'] = (el) => {
  const d = deckById(el.dataset.id);
  const p = prefsOf(d);
  if (p.mode === 'mc' && d.cards.length < 4) return toast('Multiple choice needs at least 4 cards in the deck.');
  const pool = p.scope === 'all' ? d.cards : p.scope === 'weak' ? weakCards(d) : dueCards(d);
  if (!pool.length) {
    return toast(p.scope === 'weak' ? 'No hard cards yet. Study a few rounds first.' : p.scope === 'due' ? 'Nothing is due right now. Try "All cards".' : 'This deck has no cards yet.');
  }
  const queue = shuffle(pool).map((c) => ({ id: c.id, dir: p.dir === 'both' ? (Math.random() < 0.5 ? 'f' : 'b') : p.dir }));
  study = { deckId: d.id, mode: p.mode, queue, total: queue.length, again: 0, finished: false };
  prepare();
  rerender();
  focusAnswer();
};
actions['study-quit'] = () => {
  study = null;
  rerender();
};
actions['study-flip'] = () => {
  if (study && !study.finished && cardMode() === 'flip') {
    study.flipped = !study.flipped;
    rerender();
  }
};
actions['study-rate'] = (el) => rate(el.dataset.rating);

actions['type-check'] = (el) => {
  if (!study || study.phase !== 'ask') return;
  const given = el && el.dataset && el.dataset.skip ? '' : document.getElementById('type-answer').value;
  const { item, card } = currentCard();
  study.result = { verdict: judge(given, answerText(card, item.dir)), given };
  study.phase = 'result';
  rerender();
};
actions['type-next'] = (el) => rate(study.result.verdict === 'correct' || (el && el.dataset && el.dataset.override) ? 'good' : 'again');

const pick = (i) => {
  if (!study || study.phase !== 'ask' || i < 0 || i >= study.options.length) return;
  study.picked = i;
  study.phase = 'result';
  rerender();
};
actions['mc-pick'] = (el) => pick(Number(el.dataset.i));
actions['mc-next'] = () => rate(study.picked === study.rightIndex ? 'good' : 'again');

function rate(rating) {
  if (!study || study.finished) return;
  const d = deckById(study.deckId);
  const item = study.queue.shift();
  const c = d.cards.find((x) => x.id === item.id);
  if (c) {
    c.seen = (c.seen || 0) + 1;
    if (rating === 'again') {
      c.miss = (c.miss || 0) + 1;
      c.box = 0;
      study.again++;
      study.queue.push(item);
    } else {
      c.box = Math.min(INTERVALS.length - 1, c.box + (rating === 'easy' ? 2 : 1));
    }
    c.due = addDays(today(), INTERVALS[c.box]);
  }
  state.reviews[today()] = (state.reviews[today()] || 0) + 1;
  save();
  if (study.queue.length) prepare();
  else study.finished = true;
  rerender();
  focusAnswer();
}

document.addEventListener('keydown', (e) => {
  if (!study || study.finished) return;
  const mode = cardMode();
  const inField = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
  if (mode === 'type') {
    if (e.key !== 'Enter') return;
    if (study.phase === 'ask' && e.target.id === 'type-answer') {
      e.preventDefault();
      actions['type-check']();
    } else if (study.phase === 'result' && !inField) {
      e.preventDefault();
      actions['type-next']();
    }
    return;
  }
  if (inField) return;
  if (mode === 'mc') {
    if (study.phase === 'ask' && /^[1-4]$/.test(e.key)) pick(Number(e.key) - 1);
    else if (study.phase === 'result' && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      actions['mc-next']();
    }
    return;
  }
  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault();
    actions['study-flip']();
  } else if (study.flipped && ['1', '2', '3'].includes(e.key)) rate(['again', 'good', 'easy'][e.key - 1]);
});

// ---- views ----
const sepSelect = () =>
  `<label class="field">Separator<select data-change="bulk-sep">${Object.entries(SEPS).map(([k, v]) => `<option value="${k}" ${bulkSep === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>`;

export function cardsPage(deckId) {
  if (deckId) return deckPage(deckById(deckId));
  const opts = classNames().map((c) => `<option value="${esc(c)}">${esc(classInfo(c).name)}</option>`).join('');
  const list = state.decks.length
    ? `<div class="grid decks">${state.decks.map((d) => {
        const due = dueCards(d).length;
        return `<a class="card deck" href="#/flashcards/${d.id}" style="--c:${d.cls ? classInfo(d.cls).color : 'var(--accent)'}">
          <h3>${esc(d.name)}</h3>
          <div class="muted">${d.cls ? esc(classInfo(d.cls).name) : 'No class'}</div>
          <div class="deck-foot"><span>${d.cards.length} cards · ${masteredCount(d)} mastered</span><span class="${due ? 'due-pill' : 'muted'}">${due ? due + ' due' : 'all caught up'}</span></div>
        </a>`;
      }).join('')}</div>`
    : emptyState('🗂️', 'No decks yet', 'Make your first deck below. Paste a list of terms and definitions to fill it in one go.');
  return `
  <div class="page-head"><h1>Flashcards</h1>
    <label class="btn small">Import deck<input type="file" accept=".json,application/json" data-change="deck-import" hidden></label></div>
  ${list}
  <div class="card form-card">
    <h2>New deck</h2>
    <div class="form-row">
      <label class="field grow">Name<input id="deck-name" type="text" maxlength="60" placeholder="e.g. Cell organelles"></label>
      <label class="field">Class<select id="deck-class"><option value="">None</option>${opts}</select></label>
    </div>
    <div class="form-row">
      <label class="field grow">Cards <span class="muted">(optional, one per line: term ; definition)</span>
        <textarea id="deck-bulk" rows="5" data-input="bulk-preview" data-prev="deck-prev" placeholder="mitochondria ; makes ATP&#10;nucleus ; contains DNA"></textarea></label>
      ${sepSelect()}
    </div>
    <div id="deck-prev"></div>
    <button class="btn primary" data-action="deck-create">Create deck</button>
  </div>`;
}

function studyPanel(d) {
  const p = prefsOf(d);
  const scopes = { due: `Due today (${dueCards(d).length})`, all: `All cards (${d.cards.length})`, weak: `Hardest cards (${weakCards(d).length})` };
  const select = (key, label, map) =>
    `<label class="field">${label}<select data-change="deck-pref" data-id="${d.id}" data-key="${key}">${Object.entries(map).map(([k, v]) => `<option value="${k}" ${p[key] === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>`;
  return `
  <div class="card study-opts"><div class="form-row">
    ${select('mode', 'Mode', STUDY_MODES)}${select('dir', 'Direction', DIRS)}${select('scope', 'Cards', scopes)}
    <button class="btn primary" data-action="study-go" data-id="${d.id}" ${d.cards.length ? '' : 'disabled'}>Start studying</button>
  </div></div>`;
}

function linkOptions(d) {
  const oldest = addDays(today(), -30);
  const list = tasks().filter((e) => (!isDone(e.uid) && e.date >= oldest) || e.uid === d.link);
  return ['<option value="">None</option>']
    .concat(list.map((e) => `<option value="${esc(e.uid)}" ${d.link === e.uid ? 'selected' : ''}>${esc(displayTitle(e.title))} · ${esc(classInfo(e.classes[0] || '').name)} · ${fmtDate(e.date)}</option>`))
    .join('');
}

function deckPage(d) {
  if (!d) return emptyState('🤔', 'Deck not found', '<a href="#/flashcards">Back to flashcards</a>');
  if (study && study.deckId === d.id) return studyView(d);
  const reviews = d.cards.reduce((a, c) => a + (c.seen || 0), 0);
  const misses = d.cards.reduce((a, c) => a + (c.miss || 0), 0);
  const accuracy = reviews ? `${Math.round(100 * (1 - misses / reviews))}% accuracy over ${reviews} reviews` : 'not studied yet';
  const cardsList = d.cards.length
    ? `<div class="card-list">${d.cards.map((c) => `
        <div class="card-item"><div><strong>${esc(c.front)}</strong><div class="muted">${esc(c.back)}</div></div>
        <div class="row"><span class="box-pill" title="Level ${c.box}${c.miss ? `, missed ${c.miss} of ${c.seen}` : ''}">Lv ${c.box}${c.miss ? ` · ${c.miss}✕` : ''}</span>
        <button class="btn small" data-action="card-edit" data-id="${d.id}" data-card="${c.id}">Edit</button>
        <button class="btn small danger" data-action="card-delete" data-id="${d.id}" data-card="${c.id}" aria-label="Delete card">✕</button></div></div>`).join('')}</div>`
    : emptyState('✏️', 'No cards yet', 'Add one below, or paste a whole list.');
  return `
  <div class="page-head"><div><a class="muted small" href="#/flashcards">← All decks</a><h1>${esc(d.name)}</h1>
    <div class="muted">${d.cls ? esc(classInfo(d.cls).name) + ' · ' : ''}${d.cards.length} cards · ${masteredCount(d)} mastered · ${dueCards(d).length} due · ${accuracy}</div></div></div>
  ${studyPanel(d)}
  <div class="card form-card">
    <h2>Add cards</h2>
    <div class="form-row">
      <label class="field grow">Front<input id="card-front" type="text" maxlength="200"></label>
      <label class="field grow">Back<input id="card-back" type="text" maxlength="400"></label>
      <button class="btn primary" data-action="card-add" data-id="${d.id}">Add</button>
    </div>
    <details><summary class="muted">Paste many at once</summary>
      <div class="form-row"><label class="field grow">Cards
        <textarea id="bulk-text" rows="5" data-input="bulk-preview" data-prev="bulk-prev" placeholder="term ; definition (one per line)"></textarea></label>${sepSelect()}</div>
      <div id="bulk-prev"></div>
      <button class="btn" data-action="card-bulk" data-id="${d.id}">Add pasted cards</button></details>
  </div>
  <div class="card"><label class="field">Linked assignment <span class="muted">(shows a "Study cards" button on it)</span>
    <select data-change="deck-link" data-id="${d.id}">${linkOptions(d)}</select></label></div>
  ${cardsList}
  <div class="row footer-row">
    <button class="btn small" data-action="deck-export" data-id="${d.id}">Export deck</button>
    <button class="btn small danger" data-action="deck-delete" data-id="${d.id}">Delete deck</button>
  </div>`;
}

function studyView(d) {
  if (study.finished) {
    return `<div class="card study-done">
      <div class="empty-icon">🎉</div><h2>Session complete</h2>
      <p>${study.total} cards reviewed${study.again ? `, ${study.again} needed another go` : ', no misses'}.</p>
      <div class="row center"><button class="btn primary" data-action="study-quit">Back to deck</button></div></div>`;
  }
  const mode = cardMode();
  const { item, card } = currentCard();
  const q = askText(card, item.dir);
  const a = answerText(card, item.dir);
  const done = study.total - new Set(study.queue.map((i) => i.id)).size;
  const hint = mode === 'flip' ? 'Space flips · 1 Again · 2 Good · 3 Easy' : mode === 'type' ? 'Enter checks your answer' : 'Press 1–4 to answer';
  const head = `
  <div class="page-head"><h1>${esc(d.name)}</h1><button class="btn small" data-action="study-quit">Exit</button></div>
  <div class="bar"><span style="width:${(100 * done) / study.total}%;background:var(--accent)"></span></div>
  <p class="muted small">${study.queue.length} left · ${STUDY_MODES[study.mode]} · ${hint}</p>`;

  if (mode === 'flip') {
    const face = study.flipped ? (item.dir === 'f' ? 'Back' : 'Front') : item.dir === 'f' ? 'Front' : 'Back';
    return `${head}
    <button class="flashcard ${study.flipped ? 'flipped' : ''}" data-action="study-flip" aria-label="Flip card">
      <span class="fc-label">${face}</span><span class="fc-text">${esc(study.flipped ? a : q)}</span>
    </button>
    <div class="row center rate-row ${study.flipped ? '' : 'hidden'}">
      <button class="btn danger" data-action="study-rate" data-rating="again">Again</button>
      <button class="btn" data-action="study-rate" data-rating="good">Good</button>
      <button class="btn primary" data-action="study-rate" data-rating="easy">Easy</button>
    </div>`;
  }

  if (mode === 'type') {
    if (study.phase === 'ask') {
      return `${head}
      <div class="card quiz"><span class="fc-label">Question</span><div class="fc-text">${esc(q)}</div>
        <input id="type-answer" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Type your answer">
        <div class="row center"><button class="btn primary" data-action="type-check">Check</button><button class="btn" data-action="type-check" data-skip="1">I don't know</button></div></div>`;
    }
    const v = study.result.verdict;
    const label = { correct: 'Correct ✓', almost: 'Almost. Close enough?', wrong: 'Not quite' }[v];
    return `${head}
    <div class="card quiz"><span class="fc-label">Question</span><div class="fc-text">${esc(q)}</div>
      <div class="verdict v-${v}">${label}</div>
      <div class="answer-cmp"><div><span class="fc-label">Your answer</span>${esc(study.result.given) || '—'}</div><div><span class="fc-label">Answer</span>${esc(a)}</div></div>
      <div class="row center">${v === 'correct' ? '' : '<button class="btn" data-action="type-next" data-override="1">I was right</button>'}<button class="btn primary" data-action="type-next">${v === 'correct' ? 'Next' : 'Next (counts as missed)'}</button></div></div>`;
  }

  const asked = study.phase === 'ask';
  const buttons = study.options.map((o, i) => {
    const cls = asked ? '' : i === study.rightIndex ? 'right' : i === study.picked ? 'wrong' : '';
    return `<button class="btn mc-opt ${cls}" data-action="mc-pick" data-i="${i}" ${asked ? '' : 'disabled'}><span class="mc-key">${i + 1}</span>${esc(o)}</button>`;
  }).join('');
  return `${head}
  <div class="card quiz"><span class="fc-label">Question</span><div class="fc-text">${esc(q)}</div>
    <div class="mc-list">${buttons}</div>
    ${asked ? '' : `<div class="verdict ${study.picked === study.rightIndex ? 'v-correct' : 'v-wrong'}">${study.picked === study.rightIndex ? 'Correct ✓' : 'Not quite'}</div><div class="row center"><button class="btn primary" data-action="mc-next">Next</button></div>`}</div>`;
}
