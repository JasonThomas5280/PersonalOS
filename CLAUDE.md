# Personal Operating System

A single-user life-management app that applies enterprise implementation-PM discipline
(phases, RAID logs, capacity planning, critical path) to personal life, blended with
Covey's 7 Habits (roles, quadrants, renewal) and Tony Robbins' RPM (Result / Purpose /
Massive Action Plan). Migrated from a Claude.ai artifact prototype.

`seed/initial-state.json` is **placeholder sample data**, not a real export — it defines
the canonical data shapes and exercises every table, nothing more. The prototype's
onboarding was never run, so no artifact export exists. Real data comes from the guided
setup at `/onboarding`, or by replacing that file and running `npm run seed`.

## Stack

- Next.js (App Router) + TypeScript
- Postgres via Prisma (`prisma/schema.prisma` is the source of truth)
- Deployed on Vercel; single user behind auth (Clerk)
- AI Coach + Capture call the Anthropic API from **server-side route handlers only** —
  never from the client; the API key never ships to the browser

## Domain vocabulary (use these words exactly)

- **Roles** are the spine. Everything tags to a role: outcomes, Big 3 items, RAID,
  people, renewal practices. A role has a mission (a standing definition, NOT a goal),
  success criteria, stewardship, a failure mode, and a review cadence.
- **Outcomes** follow RPM: Result (what finishes), Purpose (why it matters emotionally),
  Massive Action Plan. Each moves through **phases**:
  Exploring → Building → Testing → Deploying → Hypercare → Closed.
  Deploying and Hypercare are "heavy" phases for collision detection.
  An outcome serves MULTIPLE roles (many-to-many) with one marked primary.
  Outcomes carry: baselineDate (first commitment — never edit after set), targetDate,
  actualDate, leadTimeDays, weeklyHours cost, dependsOn (other outcomes), a go/no-go
  gate (checklist before committing), successCriteria (did it deliver — distinct from
  the gate), killCriteria (when to stop), hypercare exitCriteria, criticalPath flag.
- **RAID** = Risks, Actions, Issues, Decisions in one table with a `type` column.
  Risks have a trigger + severity (S1–S4) × probability (high/med/low); exposure =
  severity.n × probability.n, flag at ≥ 9. Issues have severity + classification
  (structural gap / execution defect / configuration / skill gap / environment /
  depends-on-others) + escalation path. Decisions record reasoning AND rejected
  alternatives. Every item can link to a role, an outcome, and a person. Status:
  open / in-progress / blocked / deferred / closed. Closing requires a resolution note.
- **People** follow the Quiet Operator model. Three **rings** with contact cadences:
  inner (3–5 people, 90d), working (15–20, 56d), ambient (50–150, 240d).
  Stages: spot → assess → develop → maintain. Motivation map: primary/secondary/rejected
  **engine** (money / ideology / connection / ego) + confidence. Node types:
  super-connector / gatekeeper / hub. The **ledger** has three sides: contributions
  given (categories: informational / connective / time / acknowledgment / operational /
  presence), commitments owed (due dates; overdue = "broken commitment", a critical
  alert), and potential contributions. The ledger directs generosity — it is never
  referenced when asking for something. Ethics alerts fire on extraction drift.
- **Big 3** are daily priorities, keyed by date (keep history). Each links to a role +
  outcome and carries a Covey **quadrant**: Q1 crisis, Q2 investment, Q3 interruption,
  Q4 waste. Q2 is the goal; zero-Q2 days get flagged.
- **Sharpen the Saw** = renewal in four dimensions (physical / mental / spiritual /
  social). Each has a practice, cadence target, sessionMinutes, a **minimum viable
  version** (the bad-week floor) with its own minutes, depletion triggers, a linked
  role, and a session history (one row per practiced date). Consistency = sessions in
  last 28d vs cadence expectation.
- **Capacity**: capacityBudget (weekly hours for outcome work) lives on the profile.
  Collisions: total weeklyHours across active outcomes > budget; > 2 outcomes in heavy
  phases at once; > 2 outcomes flagged critical path.
- **Weekly Review** keyed by week-start date; **Retro** is quarterly, ends in owned
  process changes (mechanisms with target dates, completion tracked).

## Architecture rules

- **Alerts are derived state. Never store an alert.** The alerts engine
  (`lib/alerts.ts`) is a pure function of the database snapshot → Alert[]. It has full
  test coverage and any change to it requires updating tests in the same commit.
- Dates are stored as DATE (no time component) in UTC; "days since/until" math lives in
  one utility module, used everywhere.
- baselineDate is written once when a target date is first set, then immutable through
  the UI. Slip = targetDate − baselineDate.
- Deleting a role never cascades to delete outcomes/RAID/people — it nulls the links.
- Seed script must be idempotent (`npm run seed` twice = no duplicates).
- Keep the artifact's dark theme (#0c0c16 bg, #c9b88c gold accent) — use CSS variables,
  not hardcoded hex scattered through components.

## Commands

- `npm run dev` — local dev
- `npx prisma migrate dev` — create/apply migration after schema edits
- `npm run seed` — load seed/initial-state.json
- `npm run verify` — row counts for all 19 tables, three deep spot-checks, and a
  round-trip diff of `/api/export` against the seed file. Compares against the seed
  file only when the database actually came from it; otherwise reports counts alone.
- `npm test` — Vitest; the alerts engine suite must stay green

Postgres runs on Neon, which pools through pgbouncer — migrations need the unpooled
connection, so `DATABASE_URL` (pooled) and `DIRECT_URL` (unpooled) are both required.

## Don't

- Don't put the Anthropic API key or calls in client components
- Don't add an alerts/notifications table
- Don't rename domain terms (e.g. "tasks" for Big 3, "contacts" for People, "score"
  for the ledger — it is not a scorecard)
- Don't collapse RAID into separate tables per type
- Don't add features beyond the artifact's scope without being asked; port first

@AGENTS.md
