// Getting Toddle data into the app: from the feed link (via optional proxy) or an uploaded .ics file.
import { parseIcs } from './ics.js';
import { state, save, tasks, toggleDone } from './store.js';
import { today } from './util.js';

export async function syncFromFeed() {
  const url = state.feedUrl.trim();
  if (!url) throw new Error('Paste your Toddle calendar link in Settings first.');
  const proxy = state.settings.proxy.trim();
  const target = proxy ? proxy + encodeURIComponent(url) : url;
  let res;
  try {
    res = await fetch(target, { cache: 'no-store' });
  } catch (e) {
    const err = new Error(
      proxy
        ? 'The proxy could not be reached. Check the proxy address in Settings.'
        : 'Toddle only allows its own website to download this feed, so the browser blocked it. Upload the .ics file instead, or set up a proxy (see the README).'
    );
    err.blocked = true;
    throw err;
  }
  if (!res.ok) throw new Error(`Toddle answered with an error (${res.status}). The link may have expired.`);
  return importText(await res.text());
}

export function importText(text) {
  if (!text.includes('BEGIN:VCALENDAR')) throw new Error('That does not look like a calendar (.ics) file.');
  const events = parseIcs(text);
  if (!events.length) throw new Error('No events found in that calendar.');
  state.events = events;
  state.lastSync = Date.now();
  save();
  return events.length;
}

// One-time offer so a fresh import doesn't show weeks of old work as overdue.
export function offerMarkPastDone() {
  if (state.pastPrompted) return;
  state.pastPrompted = true;
  const t = today();
  const past = tasks().filter((e) => e.date < t && !state.done[e.uid]);
  save();
  if (!past.length) return;
  if (confirm(`Mark the ${past.length} assignments that are already past their due date as done?\n\nYou can still untick any of them later.`)) {
    past.forEach((e) => toggleDone(e.uid, 'bulk'));
  }
}
