/**
 * Idempotent seed: loads seed/initial-state.json (the artifact prototype's
 * exported state) into the Prisma schema.
 *
 * Shape mapping (prototype → schema):
 *   outcome.roles (array of role slugs)  → OutcomeRole rows
 *   outcome.role (single slug)           → Outcome.primaryRoleId
 *   outcome.dependsOn (array of ids)     → OutcomeDependency rows
 *   outcome.gate (array)                 → GateItem rows
 *   person.roles / person.outcomes       → PersonRole / PersonOutcome rows
 *   person.given / owed / potential      → Contribution / Commitment / PotentialContribution
 *   saw[dimension].history (array of dates) → SawSession rows
 *   bigThree keyed by date, 3 slots      → BigThreeItem rows (unique on [date, slot])
 *   retro.changes                        → ProcessChange rows
 *
 * Idempotency strategy: every top-level entity keeps its stable id from the
 * export (or a deterministic fallback), so re-running upserts the same rows.
 * Child collections are delete-and-recreated per seeded parent with
 * deterministic ids, so edits to the file are reflected and nothing duplicates.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient, Prisma } from "@prisma/client";

// Minimal .env loader so `npm run seed` works without extra deps.
const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"?([^"#]*)"?\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

const prisma = new PrismaClient();

/* ── helpers ─────────────────────────────────────────────── */

/** "5x-week" | "FIVE_X_WEEK" | "3x/week" | prototype tokens like "5x", "prekickoff" → enum token */
function normToken(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  const t = String(v)
    .trim()
    .toUpperCase()
    .replace(/[\s/-]+/g, "_");
  // Aliases used by the artifact prototype's export
  const ALIASES: Record<string, string> = {
    "5X": "FIVE_X_WEEK",
    "5X_WEEK": "FIVE_X_WEEK",
    "3X": "THREE_X_WEEK",
    "3X_WEEK": "THREE_X_WEEK",
    SUPERCONNECTOR: "SUPER_CONNECTOR",
    PREKICKOFF: "EXPLORING",
    PRE_KICKOFF: "EXPLORING",
    // CLAUDE.md states risk probability as "high/med/low"; the enum is MEDIUM.
    // Without this, a real export carrying "med" aborts the entire seed.
    MED: "MEDIUM",
  };
  return ALIASES[t] ?? t;
}

function asEnum<T extends string>(values: readonly T[], v: unknown, ctx: string): T | null {
  const t = normToken(v);
  if (t === null) return null;
  if ((values as readonly string[]).includes(t)) return t as T;
  throw new Error(`Unrecognized value ${JSON.stringify(v)} for ${ctx}`);
}

const PHASE = ["EXPLORING", "BUILDING", "TESTING", "DEPLOYING", "HYPERCARE", "CLOSED"] as const;
const HEALTH = ["GREEN", "YELLOW", "RED"] as const;
const RAID_TYPE = ["RISK", "ACTION", "ISSUE", "DECISION"] as const;
const RAID_STATUS = ["OPEN", "IN_PROGRESS", "BLOCKED", "DEFERRED", "CLOSED"] as const;
const SEVERITY = ["S1", "S2", "S3", "S4"] as const;
const PROBABILITY = ["HIGH", "MEDIUM", "LOW"] as const;
const CLASSIFICATION = [
  "STRUCTURAL_GAP",
  "EXECUTION_DEFECT",
  "CONFIGURATION",
  "SKILL_GAP",
  "ENVIRONMENT",
  "DEPENDS_ON_OTHERS",
] as const;
const RING = ["INNER", "WORKING", "AMBIENT"] as const;
const STAGE = ["SPOT", "ASSESS", "DEVELOP", "MAINTAIN"] as const;
const ENGINE = ["MONEY", "IDEOLOGY", "CONNECTION", "EGO"] as const;
const CONFIDENCE = ["LOW", "MEDIUM", "HIGH"] as const;
const NODE_TYPE = ["SUPER_CONNECTOR", "GATEKEEPER", "HUB"] as const;
const CONTRIBUTION = [
  "INFORMATIONAL",
  "CONNECTIVE",
  "TIME",
  "ACKNOWLEDGMENT",
  "OPERATIONAL",
  "PRESENCE",
] as const;
const QUADRANT = ["Q1", "Q2", "Q3", "Q4"] as const;
const SAW_DIMENSION = ["PHYSICAL", "MENTAL", "SPIRITUAL", "SOCIAL"] as const;
const SAW_CADENCE = ["DAILY", "FIVE_X_WEEK", "THREE_X_WEEK", "WEEKLY", "BIWEEKLY"] as const;
const REVIEW_CADENCE = ["WEEKLY", "MONTHLY", "QUARTERLY"] as const;

/** "YYYY-MM-DD" → Date at UTC midnight (columns are @db.Date). */
function asDate(v: unknown, ctx: string): Date | null {
  if (v === null || v === undefined || v === "") return null;
  const m = String(v).match(/^(\d{4}-\d{2}-\d{2})/);
  if (!m) throw new Error(`Unparseable date ${JSON.stringify(v)} for ${ctx}`);
  return new Date(`${m[1]}T00:00:00.000Z`);
}

/** Prototype stores multi-line text as arrays or strings; schema stores newline-separated strings. */
function asText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) return v.map(String).join("\n");
  return String(v);
}

function asDecimal(v: unknown): Prisma.Decimal | null {
  if (v === null || v === undefined || v === "") return null;
  return new Prisma.Decimal(v as number | string);
}

function asInt(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  return Math.trunc(Number(v));
}

/** Foreign-key reference from the export: "", null, undefined all mean "not linked". */
function refOrNull(v: unknown): string | null {
  return v === null || v === undefined || v === "" ? null : String(v);
}

/** Stable id: use the export's id, else a deterministic prefix+index. */
function stableId(raw: { id?: unknown }, prefix: string, index: number): string {
  return raw.id !== undefined && raw.id !== null && raw.id !== ""
    ? String(raw.id)
    : `seed-${prefix}-${index}`;
}

/* ── main ────────────────────────────────────────────────── */

async function main() {
  const filePath = resolve(process.cwd(), "seed/initial-state.json");
  if (!existsSync(filePath)) {
    throw new Error(
      `Seed data not found at ${filePath}. Place your exported prototype state there and re-run \`npm run seed\`.`
    );
  }
  const state = JSON.parse(readFileSync(filePath, "utf8"));

  // The prototype's Big 3 export is "today's three" with no date on it; anchor
  // those rows to the export timestamp if present so re-runs stay idempotent.
  const asOf: Date =
    asDate(state.exportedAt ?? state.savedAt, "exportedAt") ??
    new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);

  /* Profile — singleton, id = 1. The prototype exports mission/capacityBudget
     at the top level; a nested profile object is also accepted. */
  const profile = state.profile ?? { mission: state.mission, capacityBudget: state.capacityBudget };
  if (profile.mission !== undefined || profile.capacityBudget !== undefined) {
    // The capacity worksheet the budget was derived from. Absent in prototype
    // exports, so every field stays null rather than defaulting to zero — a
    // zeroed worksheet would read as "no obligations" instead of "not answered".
    const w = state.capacityWorksheet ?? {};
    const data = {
      mission: asText(profile.mission),
      capacityBudget: asDecimal(profile.capacityBudget) ?? new Prisma.Decimal(12),
      sleepHours: asDecimal(w.sleep),
      workHours: asDecimal(w.work),
      commuteHours: asDecimal(w.commute),
      familyHours: asDecimal(w.family),
      householdHours: asDecimal(w.household),
      existingHours: asDecimal(w.existing),
      onboardedAt: state.onboardedAt ? new Date(String(state.onboardedAt)) : null,
    };
    await prisma.profile.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data });
  }

  /* Roles — keyed by slug (the prototype's role id, e.g. "faith").
     The prototype stores role detail in side maps keyed by role id:
     roleDetail (mission/success/stewardship/failureMode/...), roleHealth, roleNotes. */
  const roles: any[] = state.roles ?? [];
  const roleIdBySlug = new Map<string, string>();
  for (const [i, r] of roles.entries()) {
    const slug = String(r.slug ?? r.key ?? r.id ?? `role-${i}`);
    const detail = state.roleDetail?.[slug] ?? {};
    const data = {
      label: String(r.label ?? r.name ?? slug),
      icon: r.icon ? String(r.icon) : "◈",
      sortOrder: asInt(r.sortOrder) ?? i,
      health: asEnum(HEALTH, r.health ?? state.roleHealth?.[slug], `role ${slug} health`),
      statusNote: asText(r.statusNote ?? state.roleNotes?.[slug]),
      mission: asText(r.mission ?? detail.mission),
      success: asText(r.success ?? detail.success),
      stewardship: asText(r.stewardship ?? detail.stewardship),
      failureMode: asText(r.failureMode ?? detail.failureMode),
      reviewCadence: asEnum(
        REVIEW_CADENCE,
        r.reviewCadence ?? detail.reviewCadence,
        `role ${slug} reviewCadence`
      ),
      lastReviewed: asDate(r.lastReviewed ?? detail.lastReviewed, `role ${slug} lastReviewed`),
    };
    const row = await prisma.role.upsert({
      where: { slug },
      create: { slug, ...data },
      update: data,
    });
    roleIdBySlug.set(slug, row.id);
  }

  const roleRef = (v: unknown, ctx: string): string | null => {
    if (v === null || v === undefined || v === "") return null;
    const id = roleIdBySlug.get(String(v));
    if (!id) throw new Error(`Unknown role ${JSON.stringify(v)} referenced by ${ctx}`);
    return id;
  };

  /* Outcomes — keyed by exported id */
  const outcomes: any[] = state.outcomes ?? [];
  const outcomeIds = new Set<string>();
  for (const [i, o] of outcomes.entries()) {
    const id = stableId(o, "outcome", i);
    outcomeIds.add(id);
    const primaryRoleId = roleRef(o.role ?? o.primaryRole, `outcome ${id}`);
    const data = {
      result: String(o.result ?? ""),
      purpose: asText(o.purpose),
      actions: asText(o.actions),
      phase: asEnum(PHASE, o.phase, `outcome ${id} phase`) ?? "EXPLORING",
      primaryRoleId,
      baselineDate: asDate(o.baselineDate, `outcome ${id} baselineDate`),
      targetDate: asDate(o.targetDate, `outcome ${id} targetDate`),
      actualDate: asDate(o.actualDate, `outcome ${id} actualDate`),
      leadTimeDays: asInt(o.leadTimeDays),
      weeklyHours: asDecimal(o.weeklyHours),
      criticalPath: Boolean(o.criticalPath),
      successCriteria: asText(o.successCriteria),
      killCriteria: asText(o.killCriteria),
      exitCriteria: asText(o.exitCriteria),
    };
    await prisma.outcome.upsert({ where: { id }, create: { id, ...data }, update: data });

    // roles array → OutcomeRole rows (primary always included in the set)
    const roleSlugs: unknown[] = Array.isArray(o.roles) ? o.roles : [];
    const linkedRoleIds = new Set<string>(
      roleSlugs.map((s) => roleRef(s, `outcome ${id} roles`)!).filter(Boolean)
    );
    if (primaryRoleId) linkedRoleIds.add(primaryRoleId);
    await prisma.outcomeRole.deleteMany({ where: { outcomeId: id } });
    await prisma.outcomeRole.createMany({
      data: [...linkedRoleIds].map((roleId) => ({ outcomeId: id, roleId })),
    });

    // gate checklist → GateItem rows
    const gate: any[] = o.gate ?? o.gateItems ?? [];
    await prisma.gateItem.deleteMany({ where: { outcomeId: id } });
    await prisma.gateItem.createMany({
      data: gate.map((g, gi) => ({
        id: `${id}-gate-${gi}`,
        outcomeId: id,
        text: typeof g === "string" ? g : String(g.text ?? ""),
        met: typeof g === "object" && g !== null ? Boolean(g.met) : false,
        sortOrder: gi,
      })),
    });
  }

  // dependsOn → OutcomeDependency (second pass: all outcomes exist now)
  for (const [i, o] of outcomes.entries()) {
    const id = stableId(o, "outcome", i);
    const dependsOn: unknown[] = Array.isArray(o.dependsOn) ? o.dependsOn : [];
    await prisma.outcomeDependency.deleteMany({ where: { blockedId: id } });
    for (const dep of dependsOn) {
      const blockingId = String(dep);
      if (!outcomeIds.has(blockingId)) {
        throw new Error(`Outcome ${id} dependsOn unknown outcome ${blockingId}`);
      }
      await prisma.outcomeDependency.create({ data: { blockedId: id, blockingId } });
    }
  }

  /* People — keyed by exported id */
  const people: any[] = state.people ?? [];
  const personIds = new Set<string>();
  for (const [i, p] of people.entries()) {
    const id = stableId(p, "person", i);
    personIds.add(id);
    const engines = p.engines ?? {};
    const data = {
      name: String(p.name ?? ""),
      title: asText(p.title),
      employer: asText(p.employer),
      familyContext: asText(p.familyContext),
      ring: asEnum(RING, p.ring, `person ${id} ring`) ?? "WORKING",
      stage: asEnum(STAGE, p.stage, `person ${id} stage`) ?? "SPOT",
      origin: asText(p.origin),
      firstContact: asDate(p.firstContact, `person ${id} firstContact`),
      lastContact: asDate(p.lastContact, `person ${id} lastContact`),
      cadenceDays: asInt(p.cadenceDays),
      primaryEngine: asEnum(ENGINE, engines.primary ?? p.primaryEngine, `person ${id} primaryEngine`),
      secondaryEngine: asEnum(ENGINE, engines.secondary ?? p.secondaryEngine, `person ${id} secondaryEngine`),
      rejectedEngine: asEnum(ENGINE, engines.rejected ?? p.rejectedEngine, `person ${id} rejectedEngine`),
      engineConfidence:
        asEnum(CONFIDENCE, engines.confidence ?? p.engineConfidence, `person ${id} engineConfidence`) ?? "LOW",
      archetype: asText(p.archetype),
      nodeType: asEnum(NODE_TYPE, p.nodeType, `person ${id} nodeType`),
      situation: asText(p.situation),
      material: asText(p.material),
    };
    await prisma.person.upsert({ where: { id }, create: { id, ...data }, update: data });

    const personRoleIds = new Set<string>(
      (Array.isArray(p.roles) ? p.roles : []).map((s: unknown) => roleRef(s, `person ${id} roles`)!)
    );
    await prisma.personRole.deleteMany({ where: { personId: id } });
    await prisma.personRole.createMany({
      data: [...personRoleIds].map((roleId) => ({ personId: id, roleId })),
    });

    const personOutcomes: string[] = (Array.isArray(p.outcomes) ? p.outcomes : []).map(String);
    for (const oid of personOutcomes) {
      if (!outcomeIds.has(oid)) throw new Error(`Person ${id} references unknown outcome ${oid}`);
    }
    await prisma.personOutcome.deleteMany({ where: { personId: id } });
    await prisma.personOutcome.createMany({
      data: [...new Set(personOutcomes)].map((outcomeId) => ({ personId: id, outcomeId })),
    });

    // Ledger: given / owed / potential
    const given: any[] = p.given ?? [];
    await prisma.contribution.deleteMany({ where: { personId: id } });
    await prisma.contribution.createMany({
      data: given.map((c, ci) => ({
        id: `${id}-given-${ci}`,
        personId: id,
        date: asDate(c.date, `person ${id} contribution date`)!,
        category: asEnum(CONTRIBUTION, c.category, `person ${id} contribution category`)!,
        text: String(c.text ?? ""),
      })),
    });

    const owed: any[] = p.owed ?? p.commitments ?? [];
    await prisma.commitment.deleteMany({ where: { personId: id } });
    await prisma.commitment.createMany({
      data: owed.map((c, ci) => ({
        id: `${id}-owed-${ci}`,
        personId: id,
        text: String(c.text ?? ""),
        due: asDate(c.due, `person ${id} commitment due`),
        done: Boolean(c.done),
        completedOn: asDate(c.completedOn, `person ${id} commitment completedOn`),
      })),
    });

    const potential: any[] = p.potential ?? [];
    await prisma.potentialContribution.deleteMany({ where: { personId: id } });
    await prisma.potentialContribution.createMany({
      data: potential.map((c, ci) => ({
        id: `${id}-potential-${ci}`,
        personId: id,
        text: typeof c === "string" ? c : String(c.text ?? ""),
      })),
    });
  }

  /* RAID — keyed by exported id */
  const raid: any[] = state.raid ?? state.raidItems ?? [];
  for (const [i, r] of raid.entries()) {
    const id = stableId(r, "raid", i);
    const outcomeId = refOrNull(r.outcome ?? r.outcomeId);
    if (outcomeId !== null && !outcomeIds.has(outcomeId)) {
      throw new Error(`RAID ${id} references unknown outcome ${outcomeId}`);
    }
    const personId = refOrNull(r.person ?? r.personId);
    if (personId !== null && !personIds.has(personId)) {
      throw new Error(`RAID ${id} references unknown person ${personId}`);
    }
    const data = {
      type: asEnum(RAID_TYPE, r.type, `raid ${id} type`)!,
      description: String(r.description ?? ""),
      impact: asText(r.impact),
      status: asEnum(RAID_STATUS, r.status, `raid ${id} status`) ?? "OPEN",
      owner: String(r.owner ?? "Me"),
      due: asDate(r.due, `raid ${id} due`),
      trigger: asText(r.trigger),
      severity: asEnum(SEVERITY, r.severity, `raid ${id} severity`),
      probability: asEnum(PROBABILITY, r.probability, `raid ${id} probability`),
      classification: asEnum(CLASSIFICATION, r.classification, `raid ${id} classification`),
      escalation: asText(r.escalation),
      alternatives: asText(r.alternatives),
      decidedBy: asText(r.decidedBy),
      decidedOn: asDate(r.decidedOn, `raid ${id} decidedOn`),
      resolution: asText(r.resolution),
      closedOn: asDate(r.closedOn, `raid ${id} closedOn`),
      roleId: roleRef(r.role ?? r.roleId, `raid ${id}`),
      outcomeId: outcomeId === null ? null : String(outcomeId),
      personId: personId === null ? null : String(personId),
    };
    await prisma.raidItem.upsert({ where: { id }, create: { id, ...data }, update: data });
  }

  /* Big 3 — history keyed by date { "YYYY-MM-DD": [3 items] }, or the
     prototype's flat "today" array of 3 (no date → anchored to asOf). */
  const bigThreeEntries: Array<{ date: string; slot: number; item: any }> = [];
  const bigThree = state.bigThree ?? state.big3 ?? {};
  if (Array.isArray(bigThree)) {
    bigThree.forEach((item, i) => {
      if (!item?.text) return; // prototype pads empty slots
      bigThreeEntries.push({
        date: String(item.date ?? asOf.toISOString().slice(0, 10)),
        slot: asInt(item.slot) ?? i,
        item,
      });
    });
  } else {
    for (const [date, items] of Object.entries(bigThree)) {
      (items as any[]).forEach((item, slot) => bigThreeEntries.push({ date, slot, item }));
    }
  }
  for (const { date, slot, item } of bigThreeEntries) {
    const outcomeId = refOrNull(item.outcome ?? item.outcomeId);
    if (outcomeId !== null && !outcomeIds.has(outcomeId)) {
      throw new Error(`Big 3 ${date}#${slot} references unknown outcome ${outcomeId}`);
    }
    const data = {
      text: String(item.text ?? ""),
      done: Boolean(item.done),
      quadrant: asEnum(QUADRANT, item.quadrant, `big3 ${date}#${slot} quadrant`),
      roleId: roleRef(item.role ?? item.roleId, `big3 ${date}#${slot}`),
      outcomeId,
    };
    const key = { date: asDate(date, "big3 date")!, slot };
    await prisma.bigThreeItem.upsert({
      where: { date_slot: key },
      create: { ...key, ...data },
      update: data,
    });
  }

  /* Sharpen the Saw — { physical: {...}, ... } or an array with a dimension field */
  const sawRaw = state.saw ?? state.sharpenTheSaw ?? {};
  const sawList: any[] = Array.isArray(sawRaw)
    ? sawRaw
    : Object.entries(sawRaw).map(([dimension, v]) => ({ dimension, ...(v as object) }));
  for (const s of sawList) {
    const dimension = asEnum(SAW_DIMENSION, s.dimension, "saw dimension")!;
    const data = {
      practice: asText(s.practice),
      minimumViable: asText(s.minimumViable ?? s.mv),
      cadence: asEnum(SAW_CADENCE, s.cadence, `saw ${dimension} cadence`),
      sessionMinutes: asInt(s.sessionMinutes),
      mvMinutes: asInt(s.mvMinutes),
      depletes: asText(s.depletes),
      health: asEnum(HEALTH, s.health, `saw ${dimension} health`),
      note: asText(s.note),
      roleId: roleRef(s.role ?? s.roleId, `saw ${dimension}`),
    };
    const practice = await prisma.sawPractice.upsert({
      where: { dimension },
      create: { dimension, ...data },
      update: data,
    });
    // history array → SawSession rows, one per practiced date
    const history: unknown[] = Array.isArray(s.history) ? s.history : (s.sessions ?? []);
    await prisma.sawSession.deleteMany({ where: { practiceId: practice.id } });
    await prisma.sawSession.createMany({
      data: [...new Set(history.map((d) => asDate(d, `saw ${dimension} history`)!.toISOString()))].map(
        (iso, si) => ({ id: `${practice.id}-session-${si}`, practiceId: practice.id, date: new Date(iso) })
      ),
    });
  }

  /* Weekly Reviews — keyed by weekStart. The prototype exports an object
     keyed by week-start date; a flat array is also accepted. */
  const reviewsRaw = state.weeklyReviews ?? state.reviews ?? [];
  const weeklyReviews: any[] = Array.isArray(reviewsRaw)
    ? reviewsRaw
    : Object.entries(reviewsRaw).map(([weekStart, v]) => ({ weekStart, ...(v as object) }));
  for (const w of weeklyReviews) {
    const weekStart = asDate(w.weekStart ?? w.week, "weekly review weekStart")!;
    const data = {
      wins: asText(w.wins),
      misses: asText(w.misses),
      quadrant: asText(w.quadrant),
      drift: asText(w.drift),
      ledger: asText(w.ledger),
      blocked: asText(w.blocked),
      nextWeek: asText(w.nextWeek),
      gratitude: asText(w.gratitude),
      health: asEnum(HEALTH, w.health, "weekly review health"),
      healthNote: asText(w.healthNote),
    };
    await prisma.weeklyReview.upsert({
      where: { weekStart },
      create: { weekStart, ...data },
      update: data,
    });
  }

  /* Retros — keyed by exported id (fallback: quarter) */
  const retros: any[] = state.retros ?? [];
  for (const [i, r] of retros.entries()) {
    const id = r.id ? String(r.id) : `retro-${String(r.quarter ?? i).replace(/\s+/g, "-")}`;
    const data = {
      quarter: String(r.quarter ?? ""),
      date: asDate(r.date, `retro ${id} date`)!,
      wentWell: asText(r.wentWell),
      didnt: asText(r.didnt),
      rootCauses: asText(r.rootCauses),
    };
    await prisma.retro.upsert({ where: { id }, create: { id, ...data }, update: data });

    const changes: any[] = r.changes ?? [];
    await prisma.processChange.deleteMany({ where: { retroId: id } });
    await prisma.processChange.createMany({
      data: changes.map((c, ci) => ({
        id: `${id}-change-${ci}`,
        retroId: id,
        change: String(c.change ?? c.text ?? ""),
        why: asText(c.why),
        target: asDate(c.target, `retro ${id} change target`),
        done: Boolean(c.done),
      })),
    });
  }

  /* Summary: row count for every table */
  const counts: Array<[string, number]> = [
    ["Profile", await prisma.profile.count()],
    ["Role", await prisma.role.count()],
    ["Outcome", await prisma.outcome.count()],
    ["OutcomeRole", await prisma.outcomeRole.count()],
    ["OutcomeDependency", await prisma.outcomeDependency.count()],
    ["GateItem", await prisma.gateItem.count()],
    ["RaidItem", await prisma.raidItem.count()],
    ["Person", await prisma.person.count()],
    ["PersonRole", await prisma.personRole.count()],
    ["PersonOutcome", await prisma.personOutcome.count()],
    ["Contribution", await prisma.contribution.count()],
    ["Commitment", await prisma.commitment.count()],
    ["PotentialContribution", await prisma.potentialContribution.count()],
    ["BigThreeItem", await prisma.bigThreeItem.count()],
    ["SawPractice", await prisma.sawPractice.count()],
    ["SawSession", await prisma.sawSession.count()],
    ["WeeklyReview", await prisma.weeklyReview.count()],
    ["Retro", await prisma.retro.count()],
    ["ProcessChange", await prisma.processChange.count()],
  ];
  console.log("\nSeed complete. Table counts:");
  for (const [table, count] of counts) {
    console.log(`  ${table.padEnd(22)} ${count}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
