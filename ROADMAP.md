# Roadmap

Effort guide: **S** = under an hour of work, **M** = a few hours, **L** = a day or more. These are rough guesses, not measurements.

Guiding rules: keep it a static site with everything stored in the browser unless a feature truly needs a server; keep setup for students at "paste your link"; never put private links or keys in the repo.

## Now: small changes that make daily use better

| # | Feature | Why | Effort |
|---|---|---|---|
| 1 | **Today's lessons on Start.** Let each Schedule class point at a Toddle class, then show "Today: P1 Maths, P2 Sciences…" next to what's due. | Joins the two halves of the app that currently don't talk to each other. | M |
| 2 | **Notes, priority and time estimate per assignment.** Stored locally, shown in the row. | Toddle has none of these; they're the first thing you'd want when planning. | S–M |
| 3 | **Timer tied to an assignment.** Pick the task you're working on; study time then shows per assignment and per class. | Makes Progress more meaningful than class totals only. | S |
| 4 | **Search everywhere (Ctrl+K).** Assignments, flashcards, classes. | Fast navigation once you have 100+ items. | S |
| 5 | **Automated tests + a GitHub check.** Unit tests for the `.ics` parser using sample feeds; one browser smoke test. | If Toddle changes its feed format, we find out from a failing test, not from users. | S–M |
| 6 | **Accessibility and keyboard pass.** Focus order, labels, contrast in both themes, shortcuts. | Right now it's only been checked by eye. | S |

## Next: bigger features

| # | Feature | Notes | Effort |
|---|---|---|---|
| 7 | **Weekly planner.** Drag open assignments onto days, with a "do tonight" list. Auto-suggest a spread based on due dates and time estimates. | Depends on #2. | M–L |
| 8 | **Flashcard study modes.** Multiple choice, type-the-answer, cloze, and import from a pasted Quizlet-style list. Link a deck to an assignment. | The spaced-repetition core already exists. | M |
| 9 | **Assessment prep.** For each summative: countdown, plus a suggested set of study sessions leading up to it. | Depends on #7. | M |
| 10 | **Reminders.** "Due tomorrow" banner and optional browser notifications while the app is open. | True push notifications when the app is closed need a server (see below). | S–M |
| 11 | **Goals and streaks.** Weekly study-minutes goal, simple milestones. | Streak logic exists already. | S |
| 12 | **MYP criteria tracker.** Titles mention "Criterion A/B/C/D"; let people log their own grades per criterion and chart them per class. | Toddle's feed has no grades, so this would be manual entry. I've only seen one feed, so the title pattern needs checking against more data first. | M |
| 13 | **Calendar views.** Week and agenda view, export to a calendar file. | | M |
| 14 | **Display options.** Compact mode, larger text, interface language. | Ask which languages are actually wanted. | S–M |

## Later: needs a decision first

| Feature | The decision |
|---|---|
| **AI assistant** (flashcards from notes, quiz me, "what should I do first?", explain this). | Whose key pays, how much per person per day, and whether the school is happy for students' questions to go to an outside AI provider. A key can't live in the site's code, so it needs the same kind of small proxy as the Toddle sync, with per-person limits. |
| **Sync between devices** (phone, laptop, school Chromebook). | Needs a server-side store and some form of sign-in. Options are a Google Sheet behind Apps Script or a small Cloudflare database. Until then, Export/Restore backup is the way to move data. |
| **Class-wide features** (shared decks, a teacher view). | Needs accounts and a backend, so it's a different kind of project. Only worth it if teachers actually want it. |

## Risks to keep an eye on

- **Toddle changes its feed or blocks proxies.** Mitigation: tests (#5), and file upload always works as a fallback.
- **The shared sync proxy.** It handles everyone's private links. Keep it forwarding-only with no logging, and revisit if the user count grows. Apps Script has daily usage quotas that I haven't looked up, so check them before rolling out widely.
- **Browser storage can be cleared.** Data lives in each browser, so a cleared cache wipes it. A backup reminder (or sync) would help.
- **Public repository.** Nothing private is in it today. Keep it that way: no links, keys or student data in commits.

## Suggested order

1. #5 (tests), then #1 and #2, since they unlock most of the rest.
2. #3, #4, #6 as quick wins in between.
3. #7 → #9 (planning), then #8 (flashcards).
4. Decide on the AI assistant and device sync once people have used the app for a few weeks.
