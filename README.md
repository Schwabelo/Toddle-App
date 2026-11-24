# Toddle Study Hub

A static web app that turns your Toddle calendar feed into a study dashboard. No build step, no backend, no dependencies.

- **Start** – today's work, this week, the next assessment with a countdown, busy weeks, school events and the next day off
- **To-do** – every to-do across classes in Upcoming / Overdue / Done / Class material tabs, filter by class, teacher or type
- **Task details** – click any task for a side panel: due time, teacher, status, resource buttons (Slides, Docs, Forms, Edpuzzle, IXL…), the full description with its links, planning and "Open in Toddle"
- **To do / Done / Not homework** – Toddle's feed doesn't say what you handed in, and many entries are just class material (slides, videos, feedback). The app guesses which is which, you can change any task, and a one-time *Catch up* sorts out old work after the first import
- **Alerts** – warnings for overdue and soon-due to-dos and for new or moved assignments (never for class material)
- **Classes** – class tiles with teacher and progress; each class page has MYP criteria (A–D) found in task titles, filters, search, grouping by date or topic, and a colour picker
- **Calendar** – month view (holidays as one bar, assessments highlighted) and a week view with time slots and your lessons
- **Planner** – put work on days (drag, or pick a day), time estimates, load per day, auto-plan that skips weekends and school holidays, revision sessions before summatives (earlier in busy weeks), and your lessons and free periods per day
- **Schedule** – build your class timetable (`scheduler.html`); link it to Toddle classes in Settings
- **Timer** – Pomodoro focus timer that logs your study time
- **Flashcards** – make decks (paste lists with any separator, with a preview), study by flipping, typing the answer or multiple choice, either direction, or just your hardest cards; link a deck to an assignment
- **Progress** – completion per class, MYP criteria per class, focus-time chart, day streak
- **Settings** – theme, accent colour, Toddle deadline (start or end of the calendar slot), timer, planner, timetable link, backup/restore

Everything is stored in your browser (`localStorage`). Nothing is sent anywhere except the sync request to Toddle (see below). Planned work is in [ROADMAP.md](ROADMAP.md).

## Put it on GitHub Pages

1. Merge this branch into `main` (or choose this branch in the next step).
2. Repo → **Settings → Pages → Build and deployment → Deploy from a branch**, pick the branch, folder `/ (root)`.
3. Open `https://<your-username>.github.io/Toddle-App/`.

## Getting your Toddle data in

Your Toddle calendar link contains a private access key, so **it is never stored in this repo**. You paste it in *Settings*, and it stays in your browser.

Toddle's server only allows its own website (`web.toddleapp.com`) to download the feed from a browser, so a page on `github.io` can't fetch it directly. Two ways around that:

1. **Upload the file (no setup).** Open your Toddle link in a browser tab, save the `.ics` file, then use *Settings → Upload .ics file*. Repeat for fresh data.
2. **Shared sync proxy (everyone just pastes their link).** One small script, run by one person, downloads feeds on behalf of the app. Set it up once (below); users then paste their own link in *Settings* and press *Sync*.

### Shared sync proxy

The proxy only forwards `https://*.toddleapp.com/calendar/...` links, stores nothing, and must not log URLs (your link is a private key). Whoever runs it can technically see the links that pass through, so only run it with the school's agreement.

**Option A: Google Apps Script** (no new account)

1. Go to <https://script.google.com> → **New project**. Paste:

   ```js
   function doGet(e) {
     var u = (e.parameter && e.parameter.url) || '';
     if (!/^https:\/\/[\w.-]+\.toddleapp\.com\/calendar\//.test(u)) {
       return ContentService.createTextOutput('Not allowed');
     }
     var r = UrlFetchApp.fetch(u, { muteHttpExceptions: true });
     return ContentService.createTextOutput(r.getContentText());
   }
   ```
2. **Deploy → New deployment → Web app**. *Execute as:* Me. *Who has access:* Anyone. Authorize when asked. (If "Anyone" is missing, your Google Workspace admin has restricted it. Use a personal Google account instead.)
3. Copy the **Web app URL** (ends in `/exec`).

**Option B: Cloudflare Worker** (free account, nothing to do with Google)

Create a Worker, paste the code below, and add a variable `ALLOWED_ORIGIN` = `https://<your-username>.github.io` (no path, no trailing slash).

```js
// Only forwards Toddle calendar feeds, only for your site.
export default {
  async fetch(req, env) {
    const cors = { 'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN, Vary: 'Origin' };
    if (req.method === 'OPTIONS') return new Response(null, { headers: { ...cors, 'Access-Control-Allow-Methods': 'GET' } });
    if (req.headers.get('Origin') !== env.ALLOWED_ORIGIN) return new Response('Forbidden', { status: 403 });
    let u;
    try { u = new URL(new URL(req.url).searchParams.get('url')); }
    catch { return new Response('Bad url', { status: 400, headers: cors }); }
    if (u.protocol !== 'https:' || !u.hostname.endsWith('.toddleapp.com') || !u.pathname.startsWith('/calendar/'))
      return new Response('Not allowed', { status: 403, headers: cors });
    const r = await fetch(u, { redirect: 'follow' });
    return new Response(r.body, { status: r.status, headers: { ...cors, 'Content-Type': 'text/calendar' } });
  },
};
```

**Then tell the app about it (once, for everybody):** open `js/config.js` and set

```js
export const DEFAULT_PROXY = 'https://script.google.com/macros/s/XXXXXXXX/exec?url=';
```

(or your Worker address followed by `/?url=`). Commit and push. Users no longer see or need a proxy setting; they paste their link and press *Sync*. The app also re-syncs by itself in the background: when it opens (at most every 5 minutes), when you come back to the tab (after 15 minutes), and every 30 minutes while it stays open. Toddle itself refreshes the feed about every 24 hours. Turn this off in Settings → Alerts and sync.

If you use `study-hub.html` instead of the website, run `node build-single.mjs` after editing `config.js`. Note: the Cloudflare option only works from the website, not from a downloaded file.

## Install as an app (Chromebook, Android, desktop)

In Chrome, open the site and use **⋮ → Cast, save and share → Install page as app**. It then opens in its own window and works offline for everything except syncing.

## Single-file version

`study-hub.html` is the whole app in one file. Double-click it to run it locally, no server needed. Regenerate it after editing the source with `node build-single.mjs`. The tests (and CI) fail if you forget; `node build-single.mjs --check` checks without writing.

## Files

```
index.html          page shell and navigation
fonts/              Nunito (SIL Open Font License, see fonts/OFL.txt), served locally so nothing loads from Google
styles.css          all styling (light/dark, responsive)
js/ics.js           Toddle .ics parser (plain and HTML descriptions)
js/enrich.js        safe HTML, resource links, MYP criteria, to-do vs class material, topics, class colours
js/store.js         saved state
js/config.js        shared proxy address (edit this)
js/sync.js          import from link / file, background sync, new/moved detection
js/urgency.js       deadline logic: due moments (time-zone aware), overdue, due soon
js/alerts.js        banner, Needs attention page, notifications, sync status
js/pages.js         Start, Classes, Class, Progress, Settings
js/todo.js          To-do list and the one-time catch-up
js/drawer.js        task details panel
js/calendar.js      month and week views
js/dialog.js        in-page confirm dialogs
js/timetable.js     reads the Schedule data (ttlogic.js: lessons, free periods, week cycles, name matching)
js/planner.js       weekly planner (planlogic.js holds the auto-plan rules)
scheduler.html      the Class Scheduler (self-contained, shown in the Schedule section)
js/timer.js         focus timer
js/cards.js         flashcards (textmatch.js: answer checking and list parsing)
tests/              unit tests, run with: node --test tests/*.test.mjs (also checks study-hub.html is rebuilt)
tests/fixtures/     a made-up feed in Toddle's format (no real data)
.github/workflows/  runs the tests on every push
js/app.js           router and events
sw.js, manifest     offline + install support
```
