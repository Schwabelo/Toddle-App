// Getting Toddle data into the app: from the feed link (via optional proxy) or an uploaded .ics file.
import { parseIcs } from './ics.js';
import { state, save, todos, isDone, ensureClassColors } from './store.js';
import { dueMs } from './urgency.js';
import { DEFAULT_PROXY } from './config.js';

// Accepts a bare proxy address and adds the "?url=" ending if it is missing.
function normalizeProxy(p) {
  p = p.trim();
  if (!p || /[?&]url=$/.test(p)) return p;
  return p + (p.includes('?') ? '&' : '?') + 'url=';
}

export const getProxy = () => normalizeProxy(state.settings.proxy) || DEFAULT_PROXY;

// Latest sync problem, shown in Settings so it can be read and copied.
export const syncStatus = { error: null, busy: false };

const safeUrl = (u) => {
  try {
    const x = new URL(u);
    // Never show the query string (it holds the private key), nor a link that was glued onto the path.
    return x.origin + x.pathname.replace(/https?%3A.*$/i, '…');
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
  recordChanges(state.events, events);
  state.events = events;
  state.lastSync = Date.now();
  ensureClassColors();
  save();
  return events.length;
}

// Remember assignments that are new, or whose due time moved, since the previous import (kept for 3 days).
function recordChanges(before, after) {
  if (!before.length) return; // the very first import is not "news"
  const old = new Map(before.map((e) => [e.uid, e]));
  const now = Date.now();
  const found = [];
  for (const e of after) {
    if (e.kind !== 'task') continue;
    const o = old.get(e.uid);
    if (!o) found.push({ uid: e.uid, kind: 'new', at: now });
    else if (o.date !== e.date || o.time !== e.time) found.push({ uid: e.uid, kind: 'moved', from: { date: o.date, time: o.time }, at: now });
  }
  const fresh = new Set(found.map((c) => c.uid));
  state.changes = (state.changes || []).filter((c) => now - c.at < 3 * 864e5 && !fresh.has(c.uid)).concat(found);
}

// Minimum time between automatic syncs. Toddle itself only refreshes its feed about once a day.
const MIN_AGE = { open: 5 * 60e3, focus: 15 * 60e3, timer: 30 * 60e3, manual: 0 };

/**
 * Sync quietly (no dialogs, no toasts). Returns null when skipped, { changed } on success, { error: true } on failure.
 * reason: 'open' (app opened), 'focus' (tab came back), 'timer' (while left open), 'manual' (button, ignores the limits).
 */
export async function backgroundSync(reason = 'open') {
  if (syncStatus.busy || !state.feedUrl || !getProxy()) return null;
  if (reason !== 'manual' && !state.settings.autoSync) return null;
  if (Date.now() - (state.lastSync || 0) < MIN_AGE[reason]) return null;
  syncStatus.busy = true;
  const before = JSON.stringify(state.events);
  try {
    await syncFromFeed();
    syncStatus.error = null;
    return { changed: JSON.stringify(state.events) !== before };
  } catch (e) {
    syncStatus.error = e.details ? `${e.message}\n\n${e.details}` : e.message;
    return { error: true };
  } finally {
    syncStatus.busy = false;
  }
}

// After the first import, everything already past its due date is probably handed in, but the feed can't say.
// Instead of a pop-up, the Start page offers a one-time "catch up" (see catchupItems in pages.js).
export function prepareCatchup() {
  if (state.pastPrompted) return;
  state.pastPrompted = true;
  const now = Date.now();
  if (todos().some((e) => dueMs(e) < now && !isDone(e.uid))) state.catchupBefore = now;
  save();
}
