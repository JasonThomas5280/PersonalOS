import { isoDate, todayUTC } from "@/lib/dates";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Export the full database as JSON in the same shape seed/initial-state.json
 * consumes, so an export can be re-seeded (round-trip parity).
 */
export async function GET() {
  const [profile, roles, outcomes, raid, people, bigThree, saw, reviews, retros] =
    await Promise.all([
      prisma.profile.findUnique({ where: { id: 1 } }),
      prisma.role.findMany({ orderBy: { sortOrder: "asc" } }),
      prisma.outcome.findMany({
        include: { primaryRole: true, roles: { include: { role: true } }, gateItems: { orderBy: { sortOrder: "asc" } }, blockedBy: true },
      }),
      prisma.raidItem.findMany({ include: { role: true } }),
      prisma.person.findMany({
        include: { roles: { include: { role: true } }, outcomes: true, given: true, owed: true, potential: true },
      }),
      prisma.bigThreeItem.findMany({ orderBy: [{ date: "asc" }, { slot: "asc" }] }),
      prisma.sawPractice.findMany({ include: { role: true, sessions: { orderBy: { date: "asc" } } } }),
      prisma.weeklyReview.findMany({ orderBy: { weekStart: "asc" } }),
      prisma.retro.findMany({ include: { changes: true }, orderBy: { date: "asc" } }),
    ]);

  const d = (x: Date | null) => (x ? isoDate(x) : null);

  const state = {
    exportedAt: isoDate(todayUTC()),
    mission: profile?.mission ?? "",
    capacityBudget: profile ? Number(profile.capacityBudget) : 12,
    roles: roles.map((r) => ({ id: r.slug, label: r.label, icon: r.icon })),
    roleDetail: Object.fromEntries(
      roles.map((r) => [
        r.slug,
        {
          mission: r.mission,
          success: r.success,
          stewardship: r.stewardship,
          failureMode: r.failureMode,
          reviewCadence: r.reviewCadence,
          lastReviewed: d(r.lastReviewed),
        },
      ])
    ),
    roleHealth: Object.fromEntries(roles.filter((r) => r.health).map((r) => [r.slug, r.health])),
    roleNotes: Object.fromEntries(
      roles.filter((r) => r.statusNote).map((r) => [r.slug, r.statusNote])
    ),
    outcomes: outcomes.map((o) => ({
      id: o.id,
      result: o.result,
      purpose: o.purpose,
      actions: o.actions,
      phase: o.phase,
      role: o.primaryRole?.slug ?? "",
      roles: o.roles.map((x) => x.role.slug),
      baselineDate: d(o.baselineDate),
      targetDate: d(o.targetDate),
      actualDate: d(o.actualDate),
      leadTimeDays: o.leadTimeDays,
      weeklyHours: o.weeklyHours === null ? null : Number(o.weeklyHours),
      criticalPath: o.criticalPath,
      successCriteria: o.successCriteria,
      killCriteria: o.killCriteria,
      exitCriteria: o.exitCriteria,
      gate: o.gateItems.map((g) => ({ text: g.text, met: g.met })),
      dependsOn: o.blockedBy.map((x) => x.blockingId),
    })),
    raid: raid.map((r) => ({
      id: r.id,
      type: r.type,
      description: r.description,
      impact: r.impact,
      status: r.status,
      owner: r.owner,
      due: d(r.due),
      trigger: r.trigger,
      severity: r.severity,
      probability: r.probability,
      classification: r.classification,
      escalation: r.escalation,
      alternatives: r.alternatives,
      decidedBy: r.decidedBy,
      decidedOn: d(r.decidedOn),
      resolution: r.resolution,
      closedOn: d(r.closedOn),
      role: r.role?.slug ?? null,
      outcome: r.outcomeId,
      person: r.personId,
    })),
    people: people.map((p) => ({
      id: p.id,
      name: p.name,
      title: p.title,
      employer: p.employer,
      familyContext: p.familyContext,
      ring: p.ring,
      stage: p.stage,
      origin: p.origin,
      firstContact: d(p.firstContact),
      lastContact: d(p.lastContact),
      cadenceDays: p.cadenceDays,
      engines: {
        primary: p.primaryEngine,
        secondary: p.secondaryEngine,
        rejected: p.rejectedEngine,
        confidence: p.engineConfidence,
      },
      archetype: p.archetype,
      nodeType: p.nodeType,
      situation: p.situation,
      material: p.material,
      roles: p.roles.map((x) => x.role.slug),
      outcomes: p.outcomes.map((x) => x.outcomeId),
      given: p.given.map((c) => ({ date: d(c.date), category: c.category, text: c.text })),
      owed: p.owed.map((c) => ({
        text: c.text,
        due: d(c.due),
        done: c.done,
        completedOn: d(c.completedOn),
      })),
      potential: p.potential.map((c) => c.text),
    })),
    bigThree: bigThree.map((b) => ({
      date: d(b.date),
      slot: b.slot,
      text: b.text,
      done: b.done,
      quadrant: b.quadrant,
      role: roles.find((r) => r.id === b.roleId)?.slug ?? "",
      outcomeId: b.outcomeId ?? "",
    })),
    saw: Object.fromEntries(
      saw.map((s) => [
        s.dimension.toLowerCase(),
        {
          practice: s.practice,
          minimumViable: s.minimumViable,
          cadence: s.cadence,
          sessionMinutes: s.sessionMinutes,
          mvMinutes: s.mvMinutes,
          depletes: s.depletes,
          health: s.health,
          note: s.note,
          role: s.role?.slug ?? null,
          history: s.sessions.map((x) => d(x.date)),
        },
      ])
    ),
    reviews: Object.fromEntries(
      reviews.map((w) => [
        isoDate(w.weekStart),
        {
          wins: w.wins,
          misses: w.misses,
          quadrant: w.quadrant,
          drift: w.drift,
          ledger: w.ledger,
          blocked: w.blocked,
          nextWeek: w.nextWeek,
          gratitude: w.gratitude,
          health: w.health,
          healthNote: w.healthNote,
        },
      ])
    ),
    retros: retros.map((r) => ({
      id: r.id,
      quarter: r.quarter,
      date: d(r.date),
      wentWell: r.wentWell,
      didnt: r.didnt,
      rootCauses: r.rootCauses,
      changes: r.changes.map((c) => ({
        change: c.change,
        why: c.why,
        target: d(c.target),
        done: c.done,
      })),
    })),
  };

  return new Response(JSON.stringify(state, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="personal-os-export-${isoDate(todayUTC())}.json"`,
    },
  });
}
