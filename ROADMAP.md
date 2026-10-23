# Roadmap

Two features are planned: a **weekly planner** and **better flashcards**. Effort guide: **S** = under an hour, **M** = a few hours, **L** = a day or more. These are rough guesses, not measurements.

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
