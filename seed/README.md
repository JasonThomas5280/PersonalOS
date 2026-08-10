# Seed data

`initial-state.json` is the exported state of the Claude.ai artifact prototype and is the
canonical source of data shapes (see CLAUDE.md).

> **The file currently checked in is placeholder sample data.** The real prototype export
> was not available when the project was scaffolded — it was not in the repository (the
> repo had no commits) or in the uploaded files. Overwrite `initial-state.json` with your
> real export and run `npm run seed` again.

## Running

```
npm run seed
```

The script is idempotent: running it twice produces no duplicates. Top-level entities are
upserted by their stable exported ids (roles by `key`/slug, weekly reviews by `weekStart`,
saw practices by dimension, Big 3 by `[date, slot]`); child collections (gate items,
ledger entries, saw sessions, process changes, join rows) are rebuilt per parent on each
run, so edits to the file are reflected.

## Shape mapping (prototype → schema)

- top-level `mission` / `capacityBudget` → the singleton `Profile` row
- `roles` (`{id, label, icon}`) merged with the side maps `roleDetail` (mission, success,
  stewardship, failureMode…), `roleHealth`, and `roleNotes` (→ `statusNote`), all keyed by
  role id → `Role` rows (`id` becomes `slug`)
- `outcome.roles` (array of role keys) → `OutcomeRole` rows; `outcome.role` → `primaryRoleId`
  (the primary is always included in the `OutcomeRole` set)
- `outcome.dependsOn` → `OutcomeDependency`; `outcome.gate` → `GateItem`
- `person.roles` / `person.outcomes` → `PersonRole` / `PersonOutcome`
- `person.given` / `owed` / `potential` → `Contribution` / `Commitment` / `PotentialContribution`
- `saw[dimension].history` (array of dates) → `SawSession` rows
- `bigThree`: either keyed by date with three slots per day, or the prototype's flat
  "today" array (no date) — flat items are anchored to `exportedAt` (falling back to the
  day the seed runs) and empty slots are skipped
- `reviews` object keyed by week-start date → `WeeklyReview` rows
- `retro.changes` → `ProcessChange`

Enum values are normalized case-insensitively, including prototype tokens
(`"5x"`/`"3x"` → `FIVE_X_WEEK`/`THREE_X_WEEK`, `"prekickoff"` → `EXPLORING`,
`"in-progress"` → `IN_PROGRESS`, `"depends-on-others"` → `DEPENDS_ON_OTHERS`, etc.).
Multi-line fields accept either arrays (joined with newlines) or plain strings. Unknown
enum values or dangling role/outcome/person references fail the run with a clear error
rather than seeding bad data.
