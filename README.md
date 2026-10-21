# Toddle Study Hub

A static web app that turns your Toddle calendar feed into a study dashboard. No build step, no backend, no dependencies.

- **Start** – what's due today, overdue work, the next 7 days, upcoming assessments
- **Classes** – every assignment sorted into its class, with filters, search, descriptions and links back to Toddle
- **Calendar** – month view with assignments, holidays and school events
- **Timer** – Pomodoro focus timer that logs your study time
- **Flashcards** – make decks (paste a list to bulk-add), study with spaced repetition
- **Progress** – completion per class, focus-time chart, day streak
- **Settings** – theme, accent colour, timer lengths, week start, 24h time, backup/restore

Everything is stored in your browser (`localStorage`). Nothing is sent anywhere.

## Put it on GitHub Pages

1. Merge this branch into `main` (or choose this branch in the next step).
2. Repo → **Settings → Pages → Build and deployment → Deploy from a branch**, pick the branch, folder `/ (root)`.
3. Open `https://<your-username>.github.io/Toddle-App/`.

## Getting your Toddle data in

Your Toddle calendar link contains a private access key, so **it is never stored in this repo**. You paste it in *Settings*, and it stays in your browser.

Toddle's server only allows its own website (`web.toddleapp.com`) to download the feed from a browser, so a page on `github.io` can't fetch it directly. Two ways around that:

1. **Upload the file (works everywhere, no setup).** Open your Toddle link in a browser tab, save the `.ics` file, then use *Settings → Upload .ics file*. Repeat when you want fresh data.
2. **Run a tiny proxy (automatic sync).** A free Cloudflare Worker can fetch the feed for you. Create a Worker with the code below, set `ALLOWED_ORIGIN` to `https://<your-username>.github.io`, then put `https://<your-worker>.workers.dev/?url=` in *Settings → Proxy address*. The app then syncs from your link when you open it (at most once an hour).

```js
// Cloudflare Worker: only forwards Toddle calendar feeds, only for your site.
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

The proxy sees your link (including its key) when it forwards the request, so only deploy it on your own Cloudflare account.

## Install as an app (Chromebook, Android, desktop)

In Chrome, open the site and use **⋮ → Cast, save and share → Install page as app**. It then opens in its own window and works offline for everything except syncing.

## Single-file version

`study-hub.html` is the whole app in one file. Double-click it to run it locally, no server needed. Regenerate it after editing the source with `node build-single.mjs`.

## Files

```
index.html          page shell and navigation
styles.css          all styling (light/dark, responsive)
js/ics.js           Toddle .ics parser
js/store.js         saved state
js/sync.js          import from link / file
js/pages.js         Start, Classes, Calendar, Progress, Settings
js/timer.js         focus timer
js/cards.js         flashcards
js/app.js           router and events
sw.js, manifest     offline + install support
```
