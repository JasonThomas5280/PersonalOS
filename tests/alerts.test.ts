import { describe, expect, it } from "vitest";
import {
  computeAlerts,
  type Alert,
  type AlertsSnapshot,
} from "../lib/alerts";
import { addDays, daysBetween, daysUntil, isoDate, toUTCDate, weekStart } from "../lib/dates";

const NOW = toUTCDate("2026-08-10"); // a Monday

/** Empty snapshot: only the stale-weekly-review info alert fires. */
function base(overrides: Partial<AlertsSnapshot> = {}): AlertsSnapshot {
  return {
    now: NOW,
    profile: { capacityBudget: 12 },
    roles: [],
    outcomes: [],
    raidItems: [],
    people: [],
    bigThreeToday: [],
    sawPractices: [],
    weeklyReviews: [{ weekStart: weekStart(NOW) }],
    ...overrides,
  };
}

function outcome(o: Partial<AlertsSnapshot["outcomes"][number]> = {}) {
  return {
    id: "o1",
    result: "Test outcome",
    phase: "BUILDING" as const,
    baselineDate: null,
    targetDate: null,
    actualDate: null,
    leadTimeDays: null,
    weeklyHours: null,
    criticalPath: false,
    ...o,
  };
}

function person(p: Partial<AlertsSnapshot["people"][number]> = {}) {
  return {
    id: "p1",
    name: "Pat",
    ring: "WORKING" as const,
    lastContact: NOW,
    cadenceDays: null,
    given: [{ date: NOW }],
    owed: [],
    ...p,
  };
}

function ofType(alerts: Alert[], type: Alert["type"]) {
  return alerts.filter((a) => a.type === type);
}

describe("dates utilities", () => {
  it("parses YYYY-MM-DD at UTC midnight", () => {
    expect(toUTCDate("2026-08-10").toISOString()).toBe("2026-08-10T00:00:00.000Z");
  });
  it("computes day spans", () => {
    expect(daysBetween(toUTCDate("2026-08-01"), toUTCDate("2026-08-10"))).toBe(9);
    expect(daysUntil(toUTCDate("2026-08-01"), NOW)).toBe(-9);
    expect(isoDate(addDays(NOW, 5))).toBe("2026-08-15");
  });
  it("weekStart returns Monday", () => {
    expect(isoDate(weekStart(toUTCDate("2026-08-10")))).toBe("2026-08-10"); // Monday
    expect(isoDate(weekStart(toUTCDate("2026-08-13")))).toBe("2026-08-10"); // Thursday
    expect(isoDate(weekStart(toUTCDate("2026-08-16")))).toBe("2026-08-10"); // Sunday
  });
});

describe("baseline snapshot", () => {
  it("fires nothing on an empty, freshly-reviewed system", () => {
    expect(computeAlerts(base())).toEqual([]);
  });
});

describe("capacity collisions", () => {
  it("flags weekly hours over budget across active outcomes", () => {
    const alerts = computeAlerts(
      base({
        outcomes: [
          outcome({ id: "a", weeklyHours: 8 }),
          outcome({ id: "b", weeklyHours: 5 }),
          outcome({ id: "c", phase: "CLOSED", weeklyHours: 40 }), // ignored
        ],
      })
    );
    const hit = ofType(alerts, "capacity-over-budget");
    expect(hit).toHaveLength(1);
    expect(hit[0].severity).toBe("warning");
    expect(hit[0].message).toContain("13h/week");
  });

  it("stays quiet at exactly the budget", () => {
    const alerts = computeAlerts(base({ outcomes: [outcome({ weeklyHours: 12 })] }));
    expect(ofType(alerts, "capacity-over-budget")).toHaveLength(0);
  });

  it("accepts Decimal-like weeklyHours values", () => {
    const alerts = computeAlerts(
      base({ outcomes: [outcome({ weeklyHours: { toNumber: () => 12.5 } })] })
    );
    expect(ofType(alerts, "capacity-over-budget")).toHaveLength(1);
  });

  it("flags more than two outcomes in heavy phases", () => {
    const heavy = ["DEPLOYING", "HYPERCARE", "DEPLOYING"] as const;
    const two = computeAlerts(
      base({ outcomes: heavy.slice(0, 2).map((phase, i) => outcome({ id: `h${i}`, phase })) })
    );
    expect(ofType(two, "heavy-phase-collision")).toHaveLength(0);
    const three = computeAlerts(
      base({ outcomes: heavy.map((phase, i) => outcome({ id: `h${i}`, phase })) })
    );
    expect(ofType(three, "heavy-phase-collision")).toHaveLength(1);
  });

  it("flags more than two critical-path outcomes", () => {
    const alerts = computeAlerts(
      base({
        outcomes: [0, 1, 2].map((i) => outcome({ id: `c${i}`, criticalPath: true })),
      })
    );
    expect(ofType(alerts, "critical-path-collision")).toHaveLength(1);
  });
});

describe("outcome dates", () => {
  it("flags a missed target as critical, not lead-time", () => {
    const alerts = computeAlerts(
      base({ outcomes: [outcome({ targetDate: addDays(NOW, -3), leadTimeDays: 10 })] })
    );
    expect(ofType(alerts, "target-overdue")).toHaveLength(1);
    expect(ofType(alerts, "target-overdue")[0].severity).toBe("critical");
    expect(ofType(alerts, "lead-time-breach")).toHaveLength(0);
  });

  it("does not flag a delivered outcome as overdue", () => {
    const alerts = computeAlerts(
      base({
        outcomes: [outcome({ targetDate: addDays(NOW, -3), actualDate: addDays(NOW, -4) })],
      })
    );
    expect(ofType(alerts, "target-overdue")).toHaveLength(0);
  });

  it("flags entering the lead-time window", () => {
    const alerts = computeAlerts(
      base({ outcomes: [outcome({ targetDate: addDays(NOW, 5), leadTimeDays: 10 })] })
    );
    const hit = ofType(alerts, "lead-time-breach");
    expect(hit).toHaveLength(1);
    expect(hit[0].severity).toBe("warning");
  });

  it("stays quiet outside the lead-time window", () => {
    const alerts = computeAlerts(
      base({ outcomes: [outcome({ targetDate: addDays(NOW, 30), leadTimeDays: 10 })] })
    );
    expect(ofType(alerts, "lead-time-breach")).toHaveLength(0);
  });

  it("reports slip when target moved past baseline", () => {
    const alerts = computeAlerts(
      base({
        outcomes: [
          outcome({ baselineDate: toUTCDate("2026-09-01"), targetDate: toUTCDate("2026-09-15") }),
        ],
      })
    );
    const hit = ofType(alerts, "slip");
    expect(hit).toHaveLength(1);
    expect(hit[0].message).toContain("14d");
  });

  it("no slip when target equals baseline", () => {
    const alerts = computeAlerts(
      base({
        outcomes: [
          outcome({ baselineDate: toUTCDate("2026-09-01"), targetDate: toUTCDate("2026-09-01") }),
        ],
      })
    );
    expect(ofType(alerts, "slip")).toHaveLength(0);
  });

  it("ignores dates on closed outcomes", () => {
    const alerts = computeAlerts(
      base({ outcomes: [outcome({ phase: "CLOSED", targetDate: addDays(NOW, -30) })] })
    );
    expect(ofType(alerts, "target-overdue")).toHaveLength(0);
  });
});

describe("people: commitments, cadence, ethics", () => {
  it("flags an overdue commitment as a critical broken commitment", () => {
    const alerts = computeAlerts(
      base({
        people: [person({ owed: [{ text: "Send intro", due: addDays(NOW, -1), done: false }] })],
      })
    );
    const hit = ofType(alerts, "broken-commitment");
    expect(hit).toHaveLength(1);
    expect(hit[0].severity).toBe("critical");
    expect(hit[0].personId).toBe("p1");
  });

  it("ignores done or undated commitments", () => {
    const alerts = computeAlerts(
      base({
        people: [
          person({
            owed: [
              { text: "Done one", due: addDays(NOW, -10), done: true },
              { text: "No date", due: null, done: false },
            ],
          }),
        ],
      })
    );
    expect(ofType(alerts, "broken-commitment")).toHaveLength(0);
  });

  it("fires the ethics alert on two or more broken commitments to one person", () => {
    const alerts = computeAlerts(
      base({
        people: [
          person({
            owed: [
              { text: "One", due: addDays(NOW, -1), done: false },
              { text: "Two", due: addDays(NOW, -2), done: false },
            ],
          }),
        ],
      })
    );
    expect(ofType(alerts, "ethics-extraction-drift")).toHaveLength(1);
    expect(ofType(alerts, "ethics-extraction-drift")[0].severity).toBe("critical");
  });

  it("uses ring default cadence for contact-overdue (working = 56d)", () => {
    const alerts = computeAlerts(
      base({ people: [person({ lastContact: addDays(NOW, -57) })] })
    );
    expect(ofType(alerts, "contact-overdue")).toHaveLength(1);
    const quiet = computeAlerts(base({ people: [person({ lastContact: addDays(NOW, -56) })] }));
    expect(ofType(quiet, "contact-overdue")).toHaveLength(0);
  });

  it("honors a per-person cadence override", () => {
    const alerts = computeAlerts(
      base({ people: [person({ cadenceDays: 7, lastContact: addDays(NOW, -8) })] })
    );
    expect(ofType(alerts, "contact-overdue")).toHaveLength(1);
  });

  it("nudges when nothing was given to an inner/working person in 90d", () => {
    const alerts = computeAlerts(
      base({ people: [person({ given: [{ date: addDays(NOW, -91) }] })] })
    );
    const hit = ofType(alerts, "ledger-quiet");
    expect(hit).toHaveLength(1);
    expect(hit[0].severity).toBe("info");
  });

  it("does not nudge for ambient-ring people", () => {
    const alerts = computeAlerts(
      base({ people: [person({ ring: "AMBIENT", given: [], lastContact: null })] })
    );
    expect(ofType(alerts, "ledger-quiet")).toHaveLength(0);
  });
});

describe("RAID", () => {
  const risk = (severity: "S1" | "S2" | "S3" | "S4", probability: "HIGH" | "MEDIUM" | "LOW") => ({
    id: `r-${severity}-${probability}`,
    type: "RISK" as const,
    status: "OPEN" as const,
    description: "risk",
    due: null,
    severity,
    probability,
  });

  it("flags exposure ≥ 9 (S2×high = 9, S1×high = 12)", () => {
    const alerts = computeAlerts(base({ raidItems: [risk("S2", "HIGH"), risk("S1", "HIGH")] }));
    expect(ofType(alerts, "risk-exposure")).toHaveLength(2);
    expect(ofType(alerts, "risk-exposure")[0].severity).toBe("critical");
  });

  it("stays quiet below 9 (S1×medium = 8)", () => {
    const alerts = computeAlerts(base({ raidItems: [risk("S1", "MEDIUM")] }));
    expect(ofType(alerts, "risk-exposure")).toHaveLength(0);
  });

  it("ignores closed risks", () => {
    const alerts = computeAlerts(
      base({ raidItems: [{ ...risk("S1", "HIGH"), status: "CLOSED" as const }] })
    );
    expect(ofType(alerts, "risk-exposure")).toHaveLength(0);
  });

  it("surfaces blocked items of any type", () => {
    const alerts = computeAlerts(
      base({
        raidItems: [
          {
            id: "a1",
            type: "ACTION",
            status: "BLOCKED",
            description: "stuck",
            due: null,
            severity: null,
            probability: null,
          },
        ],
      })
    );
    expect(ofType(alerts, "raid-blocked")).toHaveLength(1);
  });
});

describe("Big 3 quadrants", () => {
  it("flags a planned day with zero Q2", () => {
    const alerts = computeAlerts(
      base({
        bigThreeToday: [
          { slot: 0, text: "Fire", quadrant: "Q1" },
          { slot: 1, text: "Interrupt", quadrant: "Q3" },
        ],
      })
    );
    expect(ofType(alerts, "zero-q2-day")).toHaveLength(1);
  });

  it("stays quiet when a Q2 item exists or nothing is planned", () => {
    const withQ2 = computeAlerts(
      base({ bigThreeToday: [{ slot: 0, text: "Build", quadrant: "Q2" }] })
    );
    expect(ofType(withQ2, "zero-q2-day")).toHaveLength(0);
    const unplanned = computeAlerts(
      base({ bigThreeToday: [{ slot: 0, text: "", quadrant: null }] })
    );
    expect(ofType(unplanned, "zero-q2-day")).toHaveLength(0);
  });
});

describe("Sharpen the Saw consistency", () => {
  const practice = (sessions: Date[], cadence: "DAILY" | "WEEKLY" | "THREE_X_WEEK" = "THREE_X_WEEK") => ({
    id: "sp1",
    dimension: "PHYSICAL" as const,
    cadence,
    sessions: sessions.map((date) => ({ date })),
  });

  it("flags a practice below half its 28d expectation", () => {
    // THREE_X_WEEK expects 12/28d; 5 sessions < 6 → flagged
    const alerts = computeAlerts(
      base({ sawPractices: [practice([0, 1, 2, 3, 4].map((i) => addDays(NOW, -i * 2)))] })
    );
    expect(ofType(alerts, "saw-below-cadence")).toHaveLength(1);
  });

  it("stays quiet at or above half expectation", () => {
    const alerts = computeAlerts(
      base({ sawPractices: [practice([0, 1, 2, 3, 4, 5].map((i) => addDays(NOW, -i * 2)))] })
    );
    expect(ofType(alerts, "saw-below-cadence")).toHaveLength(0);
  });

  it("only counts sessions inside the 28d window", () => {
    const alerts = computeAlerts(
      base({
        sawPractices: [practice([28, 29, 30, 31, 32, 33].map((i) => addDays(NOW, -i)), "WEEKLY")],
      })
    );
    expect(ofType(alerts, "saw-below-cadence")).toHaveLength(1);
  });

  it("skips practices with no cadence", () => {
    const alerts = computeAlerts(
      base({ sawPractices: [{ ...practice([]), cadence: null }] })
    );
    expect(ofType(alerts, "saw-below-cadence")).toHaveLength(0);
  });
});

describe("role review + weekly review freshness", () => {
  it("flags a role past its review cadence, and never-reviewed roles", () => {
    const alerts = computeAlerts(
      base({
        roles: [
          { id: "r1", label: "Faith", reviewCadence: "WEEKLY", lastReviewed: addDays(NOW, -8) },
          { id: "r2", label: "Father", reviewCadence: "WEEKLY", lastReviewed: null },
          { id: "r3", label: "Pro", reviewCadence: "MONTHLY", lastReviewed: addDays(NOW, -20) },
          { id: "r4", label: "Builder", reviewCadence: null, lastReviewed: null },
        ],
      })
    );
    const hit = ofType(alerts, "role-review-overdue");
    expect(hit.map((a) => a.roleId).sort()).toEqual(["r1", "r2"]);
  });

  it("reports a stale or missing weekly review", () => {
    const stale = computeAlerts(base({ weeklyReviews: [{ weekStart: addDays(NOW, -8) }] }));
    expect(ofType(stale, "stale-weekly-review")).toHaveLength(1);
    const none = computeAlerts(base({ weeklyReviews: [] }));
    expect(ofType(none, "stale-weekly-review")[0].message).toBe("No weekly review yet.");
  });
});

describe("output shape", () => {
  it("sorts critical before warning before info and keeps stable ids", () => {
    const alerts = computeAlerts(
      base({
        outcomes: [outcome({ targetDate: addDays(NOW, -1) })], // critical
        weeklyReviews: [], // info
        roles: [{ id: "r1", label: "X", reviewCadence: "WEEKLY", lastReviewed: null }], // warning
      })
    );
    expect(alerts.map((a) => a.severity)).toEqual(["critical", "warning", "info"]);
    expect(alerts[0].id).toBe("target-overdue:o1");
  });
});
