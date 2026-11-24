# Roadmap

Two features: a **weekly planner** and **better flashcards**. **Status: first version of both is built.** Everything below is what was built, followed by the settings and choices I picked so they can be changed. Effort guide: **S** = under an hour, **M** = a few hours, **L** = a day or more. These are rough guesses, not measurements.

Rules for both: stay a static site with everything in the browser, work with mouse, touch and keyboard (school Chromebooks vary), and include the new data in **Export backup** and **Delete everything**.

## 1. Weekly planner

**Goal:** turn "what's due" into "what I'll do on which day."

**What exists today:** the Start page lists what's due this week, and the Calendar shows due dates. Nothing lets you decide *when* to do the work.

**What gets built**

| Piece | Details | Effort |
|---|---|---|
| Data | Per assignment: a planned day, plus an optional time estimate in minutes. Stored locally, keyed by the assignment's ID so it survives re-syncs. | S |
| Week view | Seven day columns plus an **Unplanned** tray holding open assignments due this week and anything overdue. Previous / next week and a Today button. | M |
| Planning by hand | Drag an assignment onto a day. Also a "Plan for…" menu on every row, because drag and drop is unreliable on touch screens and some Chromebooks. | M |
| Day load | Each day shows the total of its estimates against a daily limit you set in Settings (for example 90 minutes). Turns amber when over. | S |
| Warnings | Flag a task planned *after* its due date. | S |
| Auto-plan | One button that spreads unplanned work across the days before each due date, earliest deadlines first, without going over the daily limit. Always editable afterwards. | M |
| Row actions | Tick off done, open details, and start the focus timer from the planner. | S |
| Backup | Plans and estimates included in backup and reset. | S |

**Decisions needed from you**
1. **Estimates:** should every assignment start empty (you type minutes), or get a default by type (for example homework 30, summative prep 60)? Defaults are guesses, but empty means auto-plan has little to work with.
2. **Daily limit:** one number for all days, or different for weekdays and weekends?
3. **Weekends:** should auto-plan use Saturday and Sunday, or leave them free unless you drag something there?

**Risks:** the Toddle feed gives due times but no estimates, so auto-plan is only as good as the numbers entered. Dragging needs a tap-based alternative (included above).

## 2. Flashcards

**What exists today:** decks (optionally tied to a class), adding cards one by one or by pasting `term ; definition` lines, spaced-repetition studying (Again / Good / Easy with keyboard keys), deck export and import, and a count of cards due.

**What gets built**

| Piece | Details | Effort |
|---|---|---|
| Study direction | Option to study back → front, or both. | S |
| Type the answer | You type it, and it's checked ignoring capitals, accents, extra spaces and punctuation. A "mark as correct" override for near misses. | M |
| Multiple choice | Wrong options come from other cards in the same deck. Needs at least 4 cards. | M |
| Weak cards | "Study my hardest cards" based on how often each card was missed (needs a miss counter per card). | S |
| Better import | Accept pasted lists from other apps with tab, semicolon, comma or dash separators, and show a preview before adding. | S–M |
| Deck stats | Per deck: cards mastered, due today, and accuracy over the last sessions. | S |
| Link to assignment | Optionally attach a deck to an assignment, so it shows up as "Study these cards" on that assignment and in the planner. Depends on the planner. | S |

**Decisions needed from you**
1. Which modes first? My suggestion is **type the answer**, then **multiple choice**.
2. **Images on cards:** the browser stores only about 5 MB, so images would fill it quickly. I'd leave images out unless you really want them.

**Risks:** typed answers are checked by exact-ish text match, so long or free-form answers won't grade well. It suits terms and short definitions.

## Suggested order

1. Planner data and the week view with drag and "Plan for…" (the core).
2. Day load and warnings, then auto-plan.
3. Flashcards: type-the-answer and weak cards.
4. Multiple choice, import preview, deck stats.
5. Link decks to assignments (once both features exist).

## Not planned right now

Parked, not deleted: AI assistant, syncing between devices, class-wide / teacher features, automated tests, linking the Schedule section to Toddle classes, search, reminders, and an MYP criteria tracker. Say the word and any of these can come back.

## Risks to keep in mind

- **Toddle changes its feed or blocks the proxy.** Uploading the `.ics` file always works as a fallback.
- **The shared sync proxy** handles everyone's private links. Keep it forwarding-only with no logging. Apps Script has daily usage quotas that I haven't looked up, so check them before a wide rollout.
- **Browser storage can be cleared**, which wipes the data. Backups are the safeguard.
- **Public repository:** keep links, keys and student data out of commits.

## Built in the first version

**Planner** (`#/planner`): week view with a "To plan" tray, drag and drop plus a day picker on every card, minutes per assignment, daily load bar that turns amber over the limit, "after due date" and "overdue" flags, auto-plan, clear week, start the timer from a card, and a "Today's plan" card on the Start page. Plans and estimates are in backups.

**Flashcards:** flip, type-the-answer (ignores case, accents, punctuation; alternatives with `/` or `;`; one-letter typos are "almost" with an "I was right" override), multiple choice (needs 4+ cards), front→back / back→front / both, due / all / hardest cards, import preview with a separator choice, per-deck mastered count and accuracy, and a deck-to-assignment link.

**Defaults I chose (all easy to change, tell me what you prefer):**
- Daily limit 90 min, set in Settings → Planner.
- Assignments without an estimate count as 30 min (shown as "~30 min"), set in Settings → Planner.
- Auto-plan skips Saturday and Sunday, unless you tick the box in Settings → Planner.
- Overdue work is spread across the week, not stacked on one day.
- A card counts as "mastered" once it is 14+ days from its next review.
- "Hardest cards" = up to 20 cards you've missed, worst miss rate first.

**Known limits of the first version**
- Planned work that you miss is not rolled forward automatically; it stays on its old day (and still appears on Start as overdue or coming up).
- Auto-plan only looks at the week on screen. Work due after that week isn't touched.
- Typed answers are checked by text match, so long free-form answers will not grade well.
- No images on flashcards (browser storage is small).

## Built after the first version: alerts and background sync

- **One definition of "overdue"** everywhere: the exact due moment, using the time zone in the Toddle feed (so "due in 3 h" is right on any device). Before, each page compared dates only.
- **Warnings:** a banner on every page, a count on the Start icon, a "Needs attention" card on Start and a full `#/alerts` page. Work is "due soon" within 24 hours (assessments: 3 days), both adjustable in Settings → Alerts and sync. The banner updates by itself as time passes.
- **Acting on a warning:** Done, Plan today, and a menu with Open in class (scrolls to and expands that assignment), Open in planner (on the right week), Open in Toddle, Study cards, Start timer, and Ignore this one.
- **New or moved in Toddle:** each import is compared with the previous one; new assignments and changed due times are listed for 3 days.
- **Background sync:** on open (at most every 5 minutes), when you return to the tab (after 15 minutes), and every 30 minutes while open. No dialogs or toasts; a status line shows "Synced 3 min ago" or "Sync failed. Retry" with details in Settings. It never redraws the page while you are typing.
- **Browser notifications (optional):** for new warnings while the app is open in a background tab.

**Limits:** warnings and notifications only happen while the app is open in a browser, because nothing can run when it is closed without a server. New work in Toddle can take up to a day to appear because Toddle refreshes its feed about once a day. Day names like "today" and "tomorrow" follow the device's clock.

## Built after the review (November 2026)

Based on a review of a real Toddle export:

- **To do / Done / Not homework.** The feed has no submission status, and about a fifth of its entries are class material (slides, videos, feedback). Each task now gets a best-guess kind (assessments, homework and anything with work words or Forms/Edpuzzle/IXL links are to-dos), which the student can change. Class material never raises warnings and stays out of the planner.
- **Catch up** replaces the old "mark past as done?" pop-up: after the first import, older work is listed by class with Done / Not homework / Still to do, or "Mark all as done". Until it is sorted it stays out of warnings and the planner.
- **Parser:** reads Toddle's HTML description (links behind text like "Slides: Cell Theory", paragraph breaks) through a whitelist sanitizer; strips the escaped `\t` Toddle leaves in titles; only accepts `toddleapp.com` "View Task" links. A setting picks whether deadlines are the start or the end of Toddle's 30-minute slot (the feed doesn't say).
- **Fixes:** class colours are saved per class and never shift (with a picker); class cards and Progress use the exact due moment like the alerts; the planner no longer lists unplanned work twice; flashcards edit in place; in-page dialogs replace `confirm()`/`prompt()`; search only redraws the list.
- **Look:** Nunito (bundled), softer cards, class tiles with banner, subject icon and teacher, a task details side panel, resource buttons, MYP criteria chips, To-do page with tabs, calmer Start page (one warning area instead of banner + red stat + card).
- **Calendar:** holidays as continuous bars, assessments filled in their class colour, a week view with time slots and lessons.
- **Features:** MYP criteria per class and on Progress, busy-week warnings, revision sessions before summatives (3 days early in busy weeks, always on a school day), auto-plan skips school holidays, school events on Start, teacher filter, group by topic, timetable linked to Toddle classes (lessons and free periods in the planner and week view, next lesson on class pages and task details).
- **Hygiene:** build check (`--check`) plus tests that the single file is current and the service worker caches every file, CI workflow, tests for all of the above.

**Not done on purpose:** the phone layout (bottom bar with many small tabs) was left for later; the To-do tab makes it 10 items.

**Guesses to keep an eye on:** the to-do/material guess and the topic groups work from words in titles, so some will be wrong (one tap fixes a task). MYP criteria only show when a title names them. Timetable-to-class matching is by name and can be changed in Settings.

## Toddle-style theme

Colours, corner radii, borders and tag styles now follow the design tokens Toddle's own web app uses (read from web.toddleapp.com's stylesheet): red primary buttons (`#d63a3f`, darker on hover), teal-blue links (`#008392`), near-black text (`#1f1f1f`), grey secondary text (`#707070`), flat white cards with thin `#e6e6e6` borders, 6–8 px button corners, and tags as soft coloured chips (summative red, formative orange, quick task green). Class colours come from Toddle's decorative palette. Toddle's own font (Avenir Next) isn't free, so the app uses Avenir Next where the device has it (Mac, iPhone) and the bundled Nunito Sans everywhere else. The app keeps its own name and icon, so it doesn't pass itself off as Toddle.
