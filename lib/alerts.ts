/**
 * The alerts engine. Alerts are DERIVED state: this module is a pure function
 * of a database snapshot → Alert[]. Never store an alert (CLAUDE.md).
 *
 * Any change here requires updating tests/alerts.test.ts in the same commit.
 */
import { daysSince, daysUntil, isoDate, toUTCDate } from "./dates";

/* ── input snapshot (structural, so tests can build plain objects) ── */

/** Prisma Decimal or plain number; the engine only needs a number. */
type Num = number | string | { toNumber(): number };

export interface AlertsSnapshot {
  /** Today at UTC midnight — passed in so the engine stays pure. */
  now: Date;
  profile: { capacityBudget: Num } | null;
  roles: Array<{
    id: string;
    label: string;
    reviewCadence: "WEEKLY" | "MONTHLY" | "QUARTERLY" | null;
    lastReviewed: Date | null;
  }>;
  outcomes: Array<{
    id: string;
    result: string;
    phase: "EXPLORING" | "BUILDING" | "TESTING" | "DEPLOYING" | "HYPERCARE" | "CLOSED";
    baselineDate: Date | null;
    targetDate: Date | null;
    actualDate: Date | null;
    leadTimeDays: number | null;
    weeklyHours: Num | null;
    criticalPath: boolean;
  }>;
  raidItems: Array<{
    id: string;
    type: "RISK" | "ACTION" | "ISSUE" | "DECISION";
    status: "OPEN" | "IN_PROGRESS" | "BLOCKED" | "DEFERRED" | "CLOSED";
    description: string;
    due: Date | null;
    severity: "S1" | "S2" | "S3" | "S4" | null;
    probability: "HIGH" | "MEDIUM" | "LOW" | null;
  }>;
  people: Array<{
    id: string;
    name: string;
    ring: "INNER" | "WORKING" | "AMBIENT";
    lastContact: Date | null;
    cadenceDays: number | null;
    /** Contribution dates (ledger: given). */
    given: Array<{ date: Date }>;
    /** Commitments owed to this person. */
    owed: Array<{ text: string; due: Date | null; done: boolean }>;
  }>;
  /** Today's Big 3 rows only. */
  bigThreeToday: Array<{ slot: number; text: string; quadrant: "Q1" | "Q2" | "Q3" | "Q4" | null }>;
  sawPractices: Array<{
    id: string;
    dimension: "PHYSICAL" | "MENTAL" | "SPIRITUAL" | "SOCIAL";
    cadence: "DAILY" | "FIVE_X_WEEK" | "THREE_X_WEEK" | "WEEKLY" | "BIWEEKLY" | null;
    sessions: Array<{ date: Date }>;
  }>;
  weeklyReviews: Array<{ weekStart: Date }>;
}

/* ── output ── */

export type AlertSeverity = "critical" | "warning" | "info";

export interface Alert {
  /** Stable key: `${type}:${entityId}` — safe for React keys and dedup. */
  id: string;
  type:
    | "capacity-over-budget"
    | "heavy-phase-collision"
    | "critical-path-collision"
    | "target-overdue"
    | "lead-time-breach"
    | "slip"
    | "broken-commitment"
    | "contact-overdue"
    | "risk-exposure"
    | "zero-q2-day"
    | "saw-below-cadence"
    | "role-review-overdue"
    | "stale-weekly-review"
    | "raid-blocked"
    | "ethics-extraction-drift"
    | "ledger-quiet";
  severity: AlertSeverity;
  message: string;
  roleId?: string;
  outcomeId?: string;
  personId?: string;
  raidId?: string;
  sawPracticeId?: string;
}

/* ── constants ── */

export const RING_CADENCE_DAYS = { INNER: 90, WORKING: 56, AMBIENT: 240 } as const;
export const HEAVY_PHASES = ["DEPLOYING", "HYPERCARE"] as const;
export const SEVERITY_N = { S1: 4, S2: 3, S3: 2, S4: 1 } as const;
export const PROBABILITY_N = { HIGH: 3, MEDIUM: 2, LOW: 1 } as const;
export const EXPOSURE_FLAG_AT = 9;
/** Expected sessions per 28 days, by cadence. */
export const CADENCE_PER_28D = {
  DAILY: 28,
  FIVE_X_WEEK: 20,
  THREE_X_WEEK: 12,
  WEEKLY: 4,
  BIWEEKLY: 2,
} as const;
export const REVIEW_CADENCE_DAYS = { WEEKLY: 7, MONTHLY: 31, QUARTERLY: 92 } as const;

function num(v: Num | null | undefined): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "object") return v.toNumber();
  return Number(v);
}

/* ── engine ── */

export function computeAlerts(s: AlertsSnapshot): Alert[] {
  const alerts: Alert[] = [];
  const now = toUTCDate(s.now);

  /* Capacity (CLAUDE.md): budget overrun, heavy-phase pileup, critical-path pileup. */
  const active = s.outcomes.filter((o) => o.phase !== "CLOSED");
  const budget = num(s.profile?.capacityBudget);
  const committed = active.reduce((sum, o) => sum + num(o.weeklyHours), 0);
  if (budget > 0 && committed > budget) {
    alerts.push({
      id: "capacity-over-budget:profile",
      type: "capacity-over-budget",
      severity: "warning",
      message: `Active outcomes need ${committed}h/week against a ${budget}h budget.`,
    });
  }
  const heavy = active.filter((o) => (HEAVY_PHASES as readonly string[]).includes(o.phase));
  if (heavy.length > 2) {
    alerts.push({
      id: "heavy-phase-collision:profile",
      type: "heavy-phase-collision",
      severity: "warning",
      message: `${heavy.length} outcomes are in heavy phases (Deploying/Hypercare) at once.`,
    });
  }
  const critPath = active.filter((o) => o.criticalPath);
  if (critPath.length > 2) {
    alerts.push({
      id: "critical-path-collision:profile",
      type: "critical-path-collision",
      severity: "warning",
      message: `${critPath.length} outcomes are flagged critical path at once.`,
    });
  }

  /* Per-outcome dates. */
  for (const o of active) {
    if (o.targetDate && !o.actualDate && daysUntil(o.targetDate, now) < 0) {
      alerts.push({
        id: `target-overdue:${o.id}`,
        type: "target-overdue",
        severity: "critical",
        message: `"${o.result}" is ${-daysUntil(o.targetDate, now)}d past its target date.`,
        outcomeId: o.id,
      });
    } else if (
      o.targetDate &&
      o.leadTimeDays !== null &&
      daysUntil(o.targetDate, now) < o.leadTimeDays
    ) {
      alerts.push({
        id: `lead-time-breach:${o.id}`,
        type: "lead-time-breach",
        severity: "warning",
        message: `"${o.result}" is inside its ${o.leadTimeDays}d lead time (${daysUntil(o.targetDate, now)}d left).`,
        outcomeId: o.id,
      });
    }
    if (o.baselineDate && o.targetDate) {
      const slip = daysSince(o.baselineDate, o.targetDate);
      if (slip > 0) {
        alerts.push({
          id: `slip:${o.id}`,
          type: "slip",
          severity: "info",
          message: `"${o.result}" has slipped ${slip}d from baseline.`,
          outcomeId: o.id,
        });
      }
    }
  }

  /* People: broken commitments are critical (CLAUDE.md); cadence; ethics. */
  for (const p of s.people) {
    const broken = p.owed.filter((c) => !c.done && c.due && daysUntil(c.due, now) < 0);
    for (const c of broken) {
      alerts.push({
        id: `broken-commitment:${p.id}:${c.text}`,
        type: "broken-commitment",
        severity: "critical",
        message: `Broken commitment to ${p.name}: "${c.text}" (due ${isoDate(c.due!)}).`,
        personId: p.id,
      });
    }
    // Extraction drift: multiple broken commitments to one person means the
    // relationship is being drawn down. The ledger directs generosity — this
    // is the ethics tripwire.
    if (broken.length >= 2) {
      alerts.push({
        id: `ethics-extraction-drift:${p.id}`,
        type: "ethics-extraction-drift",
        severity: "critical",
        message: `Extraction drift with ${p.name}: ${broken.length} commitments owed and overdue.`,
        personId: p.id,
      });
    }
    const cadence = p.cadenceDays ?? RING_CADENCE_DAYS[p.ring];
    if (p.lastContact && daysSince(p.lastContact, now) > cadence) {
      alerts.push({
        id: `contact-overdue:${p.id}`,
        type: "contact-overdue",
        severity: "warning",
        message: `${p.name} (${p.ring.toLowerCase()} ring): ${daysSince(p.lastContact, now)}d since contact, cadence ${cadence}d.`,
        personId: p.id,
      });
    }
    // Generosity idle: inner/working relationship with no contribution given
    // in 90 days. Informational nudge, never a demand.
    if (p.ring !== "AMBIENT") {
      const recentGiven = p.given.some((g) => daysSince(g.date, now) <= 90);
      if (!recentGiven) {
        alerts.push({
          id: `ledger-quiet:${p.id}`,
          type: "ledger-quiet",
          severity: "info",
          message: `Nothing contributed to ${p.name} in 90d — the ledger directs generosity.`,
          personId: p.id,
        });
      }
    }
  }

  /* RAID: exposure = severity.n × probability.n, flag at ≥ 9; blocked items surface. */
  for (const r of s.raidItems) {
    if (r.status === "CLOSED") continue;
    if (r.type === "RISK" && r.severity && r.probability) {
      const exposure = SEVERITY_N[r.severity] * PROBABILITY_N[r.probability];
      if (exposure >= EXPOSURE_FLAG_AT) {
        alerts.push({
          id: `risk-exposure:${r.id}`,
          type: "risk-exposure",
          severity: "critical",
          message: `Risk exposure ${exposure} (${r.severity}×${r.probability.toLowerCase()}): ${r.description}`,
          raidId: r.id,
        });
      }
    }
    if (r.status === "BLOCKED") {
      alerts.push({
        id: `raid-blocked:${r.id}`,
        type: "raid-blocked",
        severity: "warning",
        message: `Blocked ${r.type.toLowerCase()}: ${r.description}`,
        raidId: r.id,
      });
    }
  }

  /* Big 3: a planned day with zero Q2 is firefighting (CLAUDE.md flags it). */
  const plannedToday = s.bigThreeToday.filter((b) => b.text.trim() !== "");
  if (plannedToday.length > 0 && !plannedToday.some((b) => b.quadrant === "Q2")) {
    alerts.push({
      id: `zero-q2-day:${isoDate(now)}`,
      type: "zero-q2-day",
      severity: "info",
      message: "No Q2 (investment) item in today's Big 3 — all urgency, no building.",
    });
  }

  /* Sharpen the Saw: sessions in last 28d vs cadence expectation. */
  for (const sp of s.sawPractices) {
    if (!sp.cadence) continue;
    const expected = CADENCE_PER_28D[sp.cadence];
    const actual = sp.sessions.filter((x) => {
      const d = daysSince(x.date, now);
      return d >= 0 && d < 28;
    }).length;
    if (actual < expected / 2) {
      alerts.push({
        id: `saw-below-cadence:${sp.id}`,
        type: "saw-below-cadence",
        severity: "warning",
        message: `${sp.dimension.toLowerCase()} renewal at ${actual}/${expected} sessions in 28d.`,
        sawPracticeId: sp.id,
      });
    }
  }

  /* Role review cadence. */
  for (const role of s.roles) {
    if (!role.reviewCadence) continue;
    const limit = REVIEW_CADENCE_DAYS[role.reviewCadence];
    if (!role.lastReviewed || daysSince(role.lastReviewed, now) > limit) {
      alerts.push({
        id: `role-review-overdue:${role.id}`,
        type: "role-review-overdue",
        severity: "warning",
        message: role.lastReviewed
          ? `${role.label} not reviewed in ${daysSince(role.lastReviewed, now)}d (${role.reviewCadence.toLowerCase()} cadence).`
          : `${role.label} has never been reviewed (${role.reviewCadence.toLowerCase()} cadence).`,
        roleId: role.id,
      });
    }
  }

  /* Weekly review freshness: none in the last 7 days = drifting. */
  const latestReview = s.weeklyReviews.reduce<Date | null>(
    (latest, w) => (latest === null || w.weekStart > latest ? w.weekStart : latest),
    null
  );
  if (!latestReview || daysSince(latestReview, now) > 7) {
    alerts.push({
      id: "stale-weekly-review:profile",
      type: "stale-weekly-review",
      severity: "info",
      message: latestReview
        ? `Last weekly review was ${daysSince(latestReview, now)}d ago.`
        : "No weekly review yet.",
    });
  }

  const order: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 };
  return alerts.sort((a, b) => order[a.severity] - order[b.severity]);
}

/**
 * Where an alert points.
 *
 * computeAlerts already resolves the entity behind every alert, but the panel
 * discarded those IDs — so "Broken commitment to Sarah" was a dead string you
 * had to go hunt down by hand. `open` expands that record's accordion
 * server-side; the fragment scrolls to it. Returns null for alerts with no
 * single destination (you are already on Today for a zero-Q2 day).
 */
export function alertHref(a: Alert): string | null {
  const to = (path: string, id?: string) => (id ? `${path}?open=${id}#${id}` : path);

  switch (a.type) {
    case "target-overdue":
    case "lead-time-breach":
    case "slip":
      return to("/outcomes", a.outcomeId);
    case "capacity-over-budget":
    case "heavy-phase-collision":
    case "critical-path-collision":
      return "/outcomes";
    case "broken-commitment":
    case "contact-overdue":
    case "ethics-extraction-drift":
    case "ledger-quiet":
      return to("/people", a.personId);
    case "risk-exposure":
    case "raid-blocked":
      return to("/raid", a.raidId);
    case "saw-below-cadence":
      return to("/sharpen", a.sawPracticeId);
    case "role-review-overdue":
      return to("/roles", a.roleId);
    case "stale-weekly-review":
      return "/review";
    case "zero-q2-day":
      return null;
  }
}
