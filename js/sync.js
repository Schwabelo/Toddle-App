// Getting Toddle data into the app: from the feed link (via optional proxy) or an uploaded .ics file.
import { parseIcs } from './ics.js';
import { state, save, tasks, toggleDone } from './store.js';
import { today } from './util.js';
import { DEFAULT_PROXY } from './config.js';

export const getProxy = () => state.settings.proxy.trim() || DEFAULT_PROXY;

// Latest sync problem, shown in Settings so it can be read and copied.
export const syncStatus = { error: null };

const safeUrl = (u) => {
  try {
    const x = new URL(u);
    return x.origin + x.pathname; // never show the query string: it holds the private key
  } catch (e) {
    return '(invalid address)';
  }
};

// Browsers hide why a request failed. A no-cors request tells "server answered but was refused" from "never got there".
async function diagnose(target) {
  const lines = [
    `Page: ${location.protocol === 'file:' ? 'local file (file://)' : location.origin}`,
    `Online: ${navigator.onLine}`,
    `Requested: ${safeUrl(target)} (query hidden)`,
  ];
  try {
    await fetch(target, { mode: 'no-cors', cache: 'no-store' });
    lines.push('Reachability test: OK. The server answered, but the browser refused to give the answer to this page (a CORS or redirect problem).');
  } catch (e) {
    lines.push(`Reachability test: FAILED (${e.name}: ${e.message}). The request never got an answer: blocked by an extension, a network filter or firewall, or no internet.`);
  }
  return lines.join('\n');
}

function fail(message, details) {
  const err = new Error(message);
  err.details = details;
  return err;
}

export async function syncFromFeed() {
  // Calendar apps hand out webcal:// links; browsers can only fetch https://.
  const url = state.feedUrl.trim().replace(/^webcals?:\/\//i, 'https://');
  if (!state.feedUrl.trim()) throw new Error('Paste your Toddle calendar link in Settings first.');
  const proxy = getProxy();
  const target = proxy ? proxy + encodeURIComponent(url) : url;
  let res;
  try {
    res = await fetch(target, { cache: 'no-store' });
  } catch (e) {
    throw fail(
      proxy
        ? 'The sync service could not be reached.'
        : 'Toddle only allows its own website to download this feed, so the browser blocked it. Upload the .ics file instead, or set up a proxy (see the README).',
      `Browser error: ${e.name}: ${e.message}\n${await diagnose(target)}\nFor the exact reason press F12, open Console and look for the red line after pressing Sync.`
    );
  }
  const text = await res.text();
  const snippet = text.slice(0, 200).replace(/\s+/g, ' ');
  if (!res.ok) throw fail(`The server answered with an error (${res.status}).`, `Status: ${res.status} ${res.statusText}\nRequested: ${safeUrl(target)} (query hidden)\nStart of reply: ${snippet}`);
  if (!text.includes('BEGIN:VCALENDAR')) {
    throw fail('Toddle did not send a calendar back. Check that the link is complete and has not expired.', `Requested: ${safeUrl(target)} (query hidden)\nStart of reply: ${snippet}`);
  }
  return importText(text);
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
