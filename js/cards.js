// Flashcard maker with simple spaced repetition (Leitner boxes).
import { state, save, classNames, classInfo } from './store.js';
import { esc, today, addDays, uid, download } from './util.js';
import { actions, changes, rerender, toast } from './ui.js';
import { emptyState } from './components.js';

const INTERVALS = [0, 1, 3, 7, 14, 30, 60];
let study = null; // { deckId, queue, flipped, total, seen, again, finished }

const deckById = (id) => state.decks.find((d) => d.id === id);
const dueCards = (d) => d.cards.filter((c) => c.due <= today());

function parseBulk(text) {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      let parts = l.split('\t');
      if (parts.length < 2) parts = l.split(/\s*(?:;|::)\s*/);
      if (parts.length < 2) return null;
      return { front: parts[0].trim(), back: parts.slice(1).join(' ').trim() };
    })
    .filter((c) => c && c.front && c.back);
}

const newCard = (front, back) => ({ id: uid(), front, back, box: 0, due: today() });

// ---- Actions ----
actions['deck-create'] = () => {
  const name = document.getElementById('deck-name').value.trim();
  if (!name) return toast('Give the deck a name first.');
  const cls = document.getElementById('deck-class').value;
  const cards = parseBulk(document.getElementById('deck-bulk').value).map((c) => newCard(c.front, c.back));
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
  const cards = parseBulk(document.getElementById('bulk-text').value);
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

actions['study-start'] = (el) => {
  const d = deckById(el.dataset.id);
  let cards = el.dataset.mode === 'all' ? [...d.cards] : dueCards(d);
  if (el.dataset.shuffle !== 'no') cards.sort(() => Math.random() - 0.5);
  if (!cards.length) return toast('Nothing to study yet.');
  study = { deckId: d.id, queue: cards.map((c) => c.id), flipped: false, total: cards.length, seen: 0, again: 0, finished: false };
  rerender();
};
actions['study-flip'] = () => {
  if (study && !study.finished) {
    study.flipped = !study.flipped;
    rerender();
  }
};
actions['study-quit'] = () => {
  study = null;
  rerender();
};
actions['study-rate'] = (el) => rate(el.dataset.rating);

function rate(rating) {
  if (!study || study.finished || !study.flipped) return;
  const d = deckById(study.deckId);
  const id = study.queue.shift();
  const c = d.cards.find((x) => x.id === id);
  if (c) {
    c.box = rating === 'again' ? 0 : Math.min(INTERVALS.length - 1, c.box + (rating === 'easy' ? 2 : 1));
    c.due = addDays(today(), INTERVALS[c.box]);
    if (rating === 'again') {
      study.queue.push(id);
      study.again++;
    }
  }
  study.seen++;
  state.reviews[today()] = (state.reviews[today()] || 0) + 1;
  save();
  study.flipped = false;
  if (!study.queue.length) study.finished = true;
  rerender();
}

// Keyboard shortcuts while studying
document.addEventListener('keydown', (e) => {
  if (!study || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault();
    actions['study-flip']();
  } else if (study.flipped && ['1', '2', '3'].includes(e.key)) rate(['again', 'good', 'easy'][e.key - 1]);
});

// ---- Views ----
export function cardsPage(deckId) {
  if (deckId) return deckPage(deckById(deckId));
  const opts = classNames().map((c) => `<option value="${esc(c)}">${esc(classInfo(c).name)}</option>`).join('');
  const list = state.decks.length
    ? `<div class="grid decks">${state.decks.map((d) => {
        const due = dueCards(d).length;
        return `<a class="card deck" href="#/flashcards/${d.id}" style="--c:${d.cls ? classInfo(d.cls).color : 'var(--accent)'}">
          <h3>${esc(d.name)}</h3>
          <div class="muted">${d.cls ? esc(classInfo(d.cls).name) : 'No class'}</div>
          <div class="deck-foot"><span>${d.cards.length} cards</span><span class="${due ? 'due-pill' : 'muted'}">${due ? due + ' due' : 'all caught up'}</span></div>
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
    <label class="field">Cards <span class="muted">(optional, one per line: term ; definition)</span>
      <textarea id="deck-bulk" rows="5" placeholder="mitochondria ; makes ATP&#10;nucleus ; contains DNA"></textarea></label>
    <button class="btn primary" data-action="deck-create">Create deck</button>
  </div>`;
}

function deckPage(d) {
  if (!d) return emptyState('🤔', 'Deck not found', '<a href="#/flashcards">Back to flashcards</a>');
  if (study && study.deckId === d.id) return studyView(d);
  const due = dueCards(d).length;
  const head = `
  <div class="page-head"><div><a class="muted small" href="#/flashcards">← All decks</a><h1>${esc(d.name)}</h1>
    <div class="muted">${d.cls ? esc(classInfo(d.cls).name) + ' · ' : ''}${d.cards.length} cards · ${due} due</div></div>
    <div class="row">
      <button class="btn primary" data-action="study-start" data-id="${d.id}" data-mode="due" ${due ? '' : 'disabled'}>Study due (${due})</button>
      <button class="btn" data-action="study-start" data-id="${d.id}" data-mode="all" ${d.cards.length ? '' : 'disabled'}>Study all</button>
    </div></div>`;
  const cardsList = d.cards.length
    ? `<div class="card-list">${d.cards.map((c) => `
        <div class="card-item"><div><strong>${esc(c.front)}</strong><div class="muted">${esc(c.back)}</div></div>
        <div class="row"><span class="box-pill" title="Box ${c.box}">Lv ${c.box}</span>
        <button class="btn small" data-action="card-edit" data-id="${d.id}" data-card="${c.id}">Edit</button>
        <button class="btn small danger" data-action="card-delete" data-id="${d.id}" data-card="${c.id}" aria-label="Delete card">✕</button></div></div>`).join('')}</div>`
    : emptyState('✏️', 'No cards yet', 'Add one below, or paste a whole list.');
  return `${head}
  <div class="card form-card">
    <h2>Add cards</h2>
    <div class="form-row">
      <label class="field grow">Front<input id="card-front" type="text" maxlength="200"></label>
      <label class="field grow">Back<input id="card-back" type="text" maxlength="400"></label>
      <button class="btn primary" data-action="card-add" data-id="${d.id}">Add</button>
    </div>
    <details><summary class="muted">Paste many at once</summary>
      <textarea id="bulk-text" rows="5" placeholder="term ; definition (one per line)"></textarea>
      <button class="btn" data-action="card-bulk" data-id="${d.id}">Add pasted cards</button></details>
  </div>
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
      <p>${study.total} cards reviewed${study.again ? `, ${study.again} needed another go` : ' — no misses'}.</p>
      <div class="row center"><button class="btn primary" data-action="study-quit">Back to deck</button></div></div>`;
  }
  const c = d.cards.find((x) => x.id === study.queue[0]);
  const done = study.total - new Set(study.queue).size;
  return `
  <div class="page-head"><h1>${esc(d.name)}</h1><button class="btn small" data-action="study-quit">Exit</button></div>
  <div class="bar"><span style="width:${(100 * done) / study.total}%;background:var(--accent)"></span></div>
  <p class="muted small">${study.queue.length} left · Space flips · 1 Again · 2 Good · 3 Easy</p>
  <button class="flashcard ${study.flipped ? 'flipped' : ''}" data-action="study-flip" aria-label="Flip card">
    <span class="fc-label">${study.flipped ? 'Back' : 'Front'}</span>
    <span class="fc-text">${esc(study.flipped ? c.back : c.front)}</span>
  </button>
  <div class="row center rate-row ${study.flipped ? '' : 'hidden'}">
    <button class="btn danger" data-action="study-rate" data-rating="again">Again</button>
    <button class="btn" data-action="study-rate" data-rating="good">Good</button>
    <button class="btn primary" data-action="study-rate" data-rating="easy">Easy</button>
  </div>`;
}

export const dueCardCount = () => state.decks.reduce((a, d) => a + dueCards(d).length, 0);
