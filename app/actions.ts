"use server";

/**
 * All mutations. Rules enforced here, not just in the UI:
 * - baselineDate is written once (first time a target date is set), then immutable.
 * - Closing a RAID item requires a resolution note.
 * - Big 3 rows are keyed by [date, slot]; history is never overwritten across days.
 */
import { revalidatePath } from "next/cache";
import type {
  Confidence,
  Engine,
  Health,
  IssueClassification,
  NodeType,
  Phase,
  Probability,
  Quadrant,
  RaidStatus,
  RaidType,
  ReviewCadence,
  Ring,
  SawCadence,
  SawDimension,
  Severity,
  Stage,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { todayUTC, toUTCDate, weekStart } from "@/lib/dates";

function refresh() {
  revalidatePath("/", "layout");
}

function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function dateOrNull(fd: FormData, key: string): Date | null {
  const v = str(fd, key);
  return v === "" ? null : toUTCDate(v);
}

function intOrNull(fd: FormData, key: string): number | null {
  const v = str(fd, key);
  return v === "" ? null : Math.trunc(Number(v));
}

function decOrNull(fd: FormData, key: string): string | null {
  const v = str(fd, key);
  return v === "" ? null : v;
}

/** "" from a <select> means "none" → null. */
function enumOrNull<T extends string>(fd: FormData, key: string): T | null {
  const v = str(fd, key);
  return v === "" ? null : (v as T);
}

function idOrNull(fd: FormData, key: string): string | null {
  const v = str(fd, key);
  return v === "" ? null : v;
}

/* ── profile ── */

export async function updateProfile(fd: FormData) {
  const data = {
    mission: str(fd, "mission"),
    capacityBudget: str(fd, "capacityBudget") || "12",
  };
  await prisma.profile.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data });
  refresh();
}

/* ── Big 3 ── */

export async function saveBigThree(fd: FormData) {
  const date = toUTCDate(str(fd, "date"));
  const slot = Number(str(fd, "slot"));
  const data = {
    text: str(fd, "text"),
    quadrant: enumOrNull<Quadrant>(fd, "quadrant"),
    roleId: idOrNull(fd, "roleId"),
    outcomeId: idOrNull(fd, "outcomeId"),
  };
  await prisma.bigThreeItem.upsert({
    where: { date_slot: { date, slot } },
    create: { date, slot, ...data },
    update: data,
  });
  refresh();
}

export async function toggleBigThreeDone(fd: FormData) {
  const date = toUTCDate(str(fd, "date"));
  const slot = Number(str(fd, "slot"));
  const item = await prisma.bigThreeItem.findUnique({ where: { date_slot: { date, slot } } });
  if (item) {
    await prisma.bigThreeItem.update({
      where: { date_slot: { date, slot } },
      data: { done: !item.done },
    });
  }
  refresh();
}

/* ── roles ── */

export async function createRole(fd: FormData) {
  const label = str(fd, "label");
  if (!label) throw new Error("Role label is required.");
  const slug =
    str(fd, "slug") ||
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  const count = await prisma.role.count();
  await prisma.role.create({
    data: { slug, label, icon: str(fd, "icon") || "◈", sortOrder: count },
  });
  refresh();
}

export async function updateRole(fd: FormData) {
  const id = str(fd, "id");
  await prisma.role.update({
    where: { id },
    data: {
      label: str(fd, "label"),
      icon: str(fd, "icon") || "◈",
      health: enumOrNull<Health>(fd, "health"),
      statusNote: str(fd, "statusNote"),
      mission: str(fd, "mission"),
      success: str(fd, "success"),
      stewardship: str(fd, "stewardship"),
      failureMode: str(fd, "failureMode"),
      reviewCadence: enumOrNull<ReviewCadence>(fd, "reviewCadence"),
    },
  });
  refresh();
}

export async function markRoleReviewed(fd: FormData) {
  await prisma.role.update({
    where: { id: str(fd, "id") },
    data: { lastReviewed: todayUTC() },
  });
  refresh();
}

/** Deleting a role nulls links (schema: SetNull) — it never cascades to outcomes/RAID/people. */
export async function deleteRole(fd: FormData) {
  await prisma.role.delete({ where: { id: str(fd, "id") } });
  refresh();
}

/* ── outcomes ── */

export async function createOutcome(fd: FormData) {
  const result = str(fd, "result");
  if (!result) throw new Error("Result is required.");
  const targetDate = dateOrNull(fd, "targetDate");
  const primaryRoleId = idOrNull(fd, "primaryRoleId");
  const roleIds = new Set(fd.getAll("roleIds").map(String).filter(Boolean));
  if (primaryRoleId) roleIds.add(primaryRoleId);
  await prisma.outcome.create({
    data: {
      result,
      purpose: str(fd, "purpose"),
      actions: str(fd, "actions"),
      phase: (str(fd, "phase") || "EXPLORING") as Phase,
      primaryRoleId,
      targetDate,
      // First commitment: baseline is written once, here or on first target edit.
      baselineDate: targetDate,
      leadTimeDays: intOrNull(fd, "leadTimeDays"),
      weeklyHours: decOrNull(fd, "weeklyHours"),
      criticalPath: str(fd, "criticalPath") === "on",
      successCriteria: str(fd, "successCriteria"),
      killCriteria: str(fd, "killCriteria"),
      exitCriteria: str(fd, "exitCriteria"),
      roles: { create: [...roleIds].map((roleId) => ({ roleId })) },
    },
  });
  refresh();
}

export async function updateOutcome(fd: FormData) {
  const id = str(fd, "id");
  const existing = await prisma.outcome.findUniqueOrThrow({ where: { id } });
  const targetDate = dateOrNull(fd, "targetDate");
  const primaryRoleId = idOrNull(fd, "primaryRoleId");
  const roleIds = new Set(fd.getAll("roleIds").map(String).filter(Boolean));
  if (primaryRoleId) roleIds.add(primaryRoleId);
  await prisma.$transaction([
    prisma.outcome.update({
      where: { id },
      data: {
        result: str(fd, "result"),
        purpose: str(fd, "purpose"),
        actions: str(fd, "actions"),
        phase: (str(fd, "phase") || existing.phase) as Phase,
        primaryRoleId,
        targetDate,
        actualDate: dateOrNull(fd, "actualDate"),
        // baselineDate: write-once. Set only if never set and a target now exists.
        ...(existing.baselineDate === null && targetDate !== null
          ? { baselineDate: targetDate }
          : {}),
        leadTimeDays: intOrNull(fd, "leadTimeDays"),
        weeklyHours: decOrNull(fd, "weeklyHours"),
        criticalPath: str(fd, "criticalPath") === "on",
        successCriteria: str(fd, "successCriteria"),
        killCriteria: str(fd, "killCriteria"),
        exitCriteria: str(fd, "exitCriteria"),
      },
    }),
    prisma.outcomeRole.deleteMany({ where: { outcomeId: id } }),
    prisma.outcomeRole.createMany({
      data: [...roleIds].map((roleId) => ({ outcomeId: id, roleId })),
    }),
  ]);
  refresh();
}

export async function deleteOutcome(fd: FormData) {
  await prisma.outcome.delete({ where: { id: str(fd, "id") } });
  refresh();
}

export async function addGateItem(fd: FormData) {
  const outcomeId = str(fd, "outcomeId");
  const text = str(fd, "text");
  if (!text) return;
  const count = await prisma.gateItem.count({ where: { outcomeId } });
  await prisma.gateItem.create({ data: { outcomeId, text, sortOrder: count } });
  refresh();
}

export async function toggleGateItem(fd: FormData) {
  const id = str(fd, "id");
  const item = await prisma.gateItem.findUniqueOrThrow({ where: { id } });
  await prisma.gateItem.update({ where: { id }, data: { met: !item.met } });
  refresh();
}

export async function deleteGateItem(fd: FormData) {
  await prisma.gateItem.delete({ where: { id: str(fd, "id") } });
  refresh();
}

export async function setDependencies(fd: FormData) {
  const blockedId = str(fd, "outcomeId");
  const blockingIds = fd.getAll("blockingIds").map(String).filter((x) => x && x !== blockedId);
  await prisma.$transaction([
    prisma.outcomeDependency.deleteMany({ where: { blockedId } }),
    prisma.outcomeDependency.createMany({
      data: blockingIds.map((blockingId) => ({ blockedId, blockingId })),
    }),
  ]);
  refresh();
}

/* ── RAID ── */

export async function createRaidItem(fd: FormData) {
  const description = str(fd, "description");
  if (!description) throw new Error("Description is required.");
  await prisma.raidItem.create({
    data: {
      type: str(fd, "type") as RaidType,
      description,
      impact: str(fd, "impact"),
      status: (str(fd, "status") || "OPEN") as RaidStatus,
      owner: str(fd, "owner") || "Me",
      due: dateOrNull(fd, "due"),
      trigger: str(fd, "trigger"),
      severity: enumOrNull<Severity>(fd, "severity"),
      probability: enumOrNull<Probability>(fd, "probability"),
      classification: enumOrNull<IssueClassification>(fd, "classification"),
      escalation: str(fd, "escalation"),
      alternatives: str(fd, "alternatives"),
      decidedBy: str(fd, "decidedBy"),
      decidedOn: dateOrNull(fd, "decidedOn"),
      roleId: idOrNull(fd, "roleId"),
      outcomeId: idOrNull(fd, "outcomeId"),
      personId: idOrNull(fd, "personId"),
    },
  });
  refresh();
}

export async function updateRaidItem(fd: FormData) {
  const id = str(fd, "id");
  const status = str(fd, "status") as RaidStatus;
  const resolution = str(fd, "resolution");
  // Closing requires a resolution note (CLAUDE.md).
  if (status === "CLOSED" && !resolution) {
    throw new Error("Closing a RAID item requires a resolution note.");
  }
  await prisma.raidItem.update({
    where: { id },
    data: {
      description: str(fd, "description"),
      impact: str(fd, "impact"),
      status,
      owner: str(fd, "owner") || "Me",
      due: dateOrNull(fd, "due"),
      trigger: str(fd, "trigger"),
      severity: enumOrNull<Severity>(fd, "severity"),
      probability: enumOrNull<Probability>(fd, "probability"),
      classification: enumOrNull<IssueClassification>(fd, "classification"),
      escalation: str(fd, "escalation"),
      alternatives: str(fd, "alternatives"),
      decidedBy: str(fd, "decidedBy"),
      decidedOn: dateOrNull(fd, "decidedOn"),
      resolution,
      closedOn:
        status === "CLOSED" ? todayUTC() : null,
      roleId: idOrNull(fd, "roleId"),
      outcomeId: idOrNull(fd, "outcomeId"),
      personId: idOrNull(fd, "personId"),
    },
  });
  refresh();
}

export async function deleteRaidItem(fd: FormData) {
  await prisma.raidItem.delete({ where: { id: str(fd, "id") } });
  refresh();
}

/* ── people ── */

export async function createPerson(fd: FormData) {
  const name = str(fd, "name");
  if (!name) throw new Error("Name is required.");
  await prisma.person.create({
    data: {
      name,
      ring: (str(fd, "ring") || "WORKING") as Ring,
      stage: (str(fd, "stage") || "SPOT") as Stage,
      title: str(fd, "title"),
      employer: str(fd, "employer"),
      origin: str(fd, "origin"),
    },
  });
  refresh();
}

export async function updatePerson(fd: FormData) {
  const id = str(fd, "id");
  const roleIds = fd.getAll("roleIds").map(String).filter(Boolean);
  const outcomeIds = fd.getAll("outcomeIds").map(String).filter(Boolean);
  await prisma.$transaction([
    prisma.person.update({
      where: { id },
      data: {
        name: str(fd, "name"),
        title: str(fd, "title"),
        employer: str(fd, "employer"),
        familyContext: str(fd, "familyContext"),
        ring: str(fd, "ring") as Ring,
        stage: str(fd, "stage") as Stage,
        origin: str(fd, "origin"),
        firstContact: dateOrNull(fd, "firstContact"),
        lastContact: dateOrNull(fd, "lastContact"),
        cadenceDays: intOrNull(fd, "cadenceDays"),
        primaryEngine: enumOrNull<Engine>(fd, "primaryEngine"),
        secondaryEngine: enumOrNull<Engine>(fd, "secondaryEngine"),
        rejectedEngine: enumOrNull<Engine>(fd, "rejectedEngine"),
        engineConfidence: (str(fd, "engineConfidence") || "LOW") as Confidence,
        archetype: str(fd, "archetype"),
        nodeType: enumOrNull<NodeType>(fd, "nodeType"),
        situation: str(fd, "situation"),
        material: str(fd, "material"),
      },
    }),
    prisma.personRole.deleteMany({ where: { personId: id } }),
    prisma.personRole.createMany({ data: roleIds.map((roleId) => ({ personId: id, roleId })) }),
    prisma.personOutcome.deleteMany({ where: { personId: id } }),
    prisma.personOutcome.createMany({
      data: outcomeIds.map((outcomeId) => ({ personId: id, outcomeId })),
    }),
  ]);
  refresh();
}

export async function deletePerson(fd: FormData) {
  await prisma.person.delete({ where: { id: str(fd, "id") } });
  refresh();
}

export async function logContact(fd: FormData) {
  await prisma.person.update({
    where: { id: str(fd, "id") },
    data: { lastContact: todayUTC() },
  });
  refresh();
}

/* Ledger. Given / owed / potential — it directs generosity, it is never a scorecard. */

export async function addContribution(fd: FormData) {
  const text = str(fd, "text");
  if (!text) return;
  await prisma.contribution.create({
    data: {
      personId: str(fd, "personId"),
      date: todayUTC(),
      category: str(fd, "category") as import("@prisma/client").ContributionCategory,
      text,
    },
  });
  refresh();
}

export async function addCommitment(fd: FormData) {
  const text = str(fd, "text");
  if (!text) return;
  await prisma.commitment.create({
    data: { personId: str(fd, "personId"), text, due: dateOrNull(fd, "due") },
  });
  refresh();
}

export async function completeCommitment(fd: FormData) {
  await prisma.commitment.update({
    where: { id: str(fd, "id") },
    data: { done: true, completedOn: todayUTC() },
  });
  refresh();
}

export async function addPotential(fd: FormData) {
  const text = str(fd, "text");
  if (!text) return;
  await prisma.potentialContribution.create({
    data: { personId: str(fd, "personId"), text },
  });
  refresh();
}

export async function deletePotential(fd: FormData) {
  await prisma.potentialContribution.delete({ where: { id: str(fd, "id") } });
  refresh();
}

/* ── Sharpen the Saw ── */

export async function updateSawPractice(fd: FormData) {
  const dimension = str(fd, "dimension") as SawDimension;
  const data = {
    practice: str(fd, "practice"),
    minimumViable: str(fd, "minimumViable"),
    cadence: enumOrNull<SawCadence>(fd, "cadence"),
    sessionMinutes: intOrNull(fd, "sessionMinutes"),
    mvMinutes: intOrNull(fd, "mvMinutes"),
    depletes: str(fd, "depletes"),
    health: enumOrNull<Health>(fd, "health"),
    note: str(fd, "note"),
    roleId: idOrNull(fd, "roleId"),
  };
  await prisma.sawPractice.upsert({
    where: { dimension },
    create: { dimension, ...data },
    update: data,
  });
  refresh();
}

/** Toggle today's session for a dimension (one row per practiced date). */
export async function toggleSawSession(fd: FormData) {
  const practiceId = str(fd, "practiceId");
  const date = todayUTC();
  const existing = await prisma.sawSession.findUnique({
    where: { practiceId_date: { practiceId, date } },
  });
  if (existing) {
    await prisma.sawSession.delete({ where: { id: existing.id } });
  } else {
    await prisma.sawSession.create({ data: { practiceId, date } });
  }
  refresh();
}

/* ── weekly review & retro ── */

export async function saveWeeklyReview(fd: FormData) {
  const ws = str(fd, "weekStart");
  const weekStartDate = ws ? toUTCDate(ws) : weekStart(todayUTC());
  const data = {
    wins: str(fd, "wins"),
    misses: str(fd, "misses"),
    quadrant: str(fd, "quadrant"),
    drift: str(fd, "drift"),
    ledger: str(fd, "ledger"),
    blocked: str(fd, "blocked"),
    nextWeek: str(fd, "nextWeek"),
    gratitude: str(fd, "gratitude"),
    health: enumOrNull<Health>(fd, "health"),
    healthNote: str(fd, "healthNote"),
  };
  await prisma.weeklyReview.upsert({
    where: { weekStart: weekStartDate },
    create: { weekStart: weekStartDate, ...data },
    update: data,
  });
  refresh();
}

export async function createRetro(fd: FormData) {
  const quarter = str(fd, "quarter");
  if (!quarter) throw new Error("Quarter is required, e.g. \"Q3 2026\".");
  await prisma.retro.create({
    data: {
      quarter,
      date: todayUTC(),
      wentWell: str(fd, "wentWell"),
      didnt: str(fd, "didnt"),
      rootCauses: str(fd, "rootCauses"),
    },
  });
  refresh();
}

export async function updateRetro(fd: FormData) {
  await prisma.retro.update({
    where: { id: str(fd, "id") },
    data: {
      wentWell: str(fd, "wentWell"),
      didnt: str(fd, "didnt"),
      rootCauses: str(fd, "rootCauses"),
    },
  });
  refresh();
}

/** A retro ends in owned process changes — mechanisms with target dates. */
export async function addProcessChange(fd: FormData) {
  const change = str(fd, "change");
  if (!change) return;
  await prisma.processChange.create({
    data: {
      retroId: str(fd, "retroId"),
      change,
      why: str(fd, "why"),
      target: dateOrNull(fd, "target"),
    },
  });
  refresh();
}

export async function toggleProcessChange(fd: FormData) {
  const id = str(fd, "id");
  const pc = await prisma.processChange.findUniqueOrThrow({ where: { id } });
  await prisma.processChange.update({ where: { id }, data: { done: !pc.done } });
  refresh();
}
