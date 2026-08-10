"use server";

/**
 * Per-step onboarding writes.
 *
 * Each step persists on its own so the flow is resumable — a closed tab costs
 * one step, not the whole setup. Repeatable steps (outcomes, RAID, people) do
 * their creates through the same server actions the tabs use, so there is one
 * write path per entity rather than an onboarding-shaped duplicate.
 */
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma, type SawCadence, type SawDimension } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { todayUTC } from "@/lib/dates";
import { href, nextSlug } from "./steps";

function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function decOrNull(fd: FormData, key: string): Prisma.Decimal | null {
  const v = str(fd, key);
  return v === "" ? null : new Prisma.Decimal(v);
}

/** Ensure the singleton exists before a step writes part of it. */
async function ensureProfile() {
  await prisma.profile.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
}

/** Persist, then move to the next step. `from` is the current step's slug. */
function advance(fd: FormData) {
  const from = str(fd, "step");
  const next = nextSlug(from);
  revalidatePath("/", "layout");
  redirect(next ? href(next) : "/");
}

/* ── 1 · mission ── */

export async function saveMission(fd: FormData) {
  await ensureProfile();
  await prisma.profile.update({ where: { id: 1 }, data: { mission: str(fd, "mission") } });
  advance(fd);
}

/* ── 2 · roles ── */

/**
 * Checked presets are upserted by slug; unchecked ones are removed only if they
 * came from the presets and carry no work yet, so re-running setup cannot
 * silently delete a role that outcomes or RAID items already point at.
 */
export async function saveRoles(fd: FormData) {
  const chosen = fd.getAll("roles").map(String);
  if (chosen.length === 0) throw new Error("Pick at least one role — they are the spine.");

  for (const [i, slug] of chosen.entries()) {
    const label = str(fd, `label-${slug}`) || slug;
    const icon = str(fd, `icon-${slug}`) || "◈";
    const mission = str(fd, `roleMission-${slug}`);
    await prisma.role.upsert({
      where: { slug },
      create: { slug, label, icon, sortOrder: i, mission },
      update: { label, icon, sortOrder: i, ...(mission ? { mission } : {}) },
    });
  }
  advance(fd);
}

/** Add a custom role and stay on the roles step. */
export async function addCustomRole(fd: FormData) {
  const label = str(fd, "customLabel");
  if (!label) return;
  const slug =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || `role-${Date.now()}`;
  const count = await prisma.role.count();
  await prisma.role.upsert({
    where: { slug },
    create: { slug, label, icon: str(fd, "customIcon") || "◈", sortOrder: count },
    update: { label, icon: str(fd, "customIcon") || "◈" },
  });
  revalidatePath("/", "layout");
}

export async function removeRole(fd: FormData) {
  // SetNull on every link (schema) — outcomes, RAID and people survive.
  await prisma.role.delete({ where: { id: str(fd, "id") } });
  revalidatePath("/", "layout");
}

/* ── 3 · role depth ── */

export async function saveRoleDepth(fd: FormData) {
  const roles = await prisma.role.findMany({ select: { id: true } });
  for (const { id } of roles) {
    const data = {
      mission: str(fd, `mission-${id}`),
      success: str(fd, `success-${id}`),
      stewardship: str(fd, `stewardship-${id}`),
      failureMode: str(fd, `failureMode-${id}`),
      reviewCadence: (str(fd, `reviewCadence-${id}`) || null) as never,
    };
    await prisma.role.update({ where: { id }, data });
  }
  advance(fd);
}

/* ── 4 · capacity ── */

export async function saveCapacity(fd: FormData) {
  await ensureProfile();
  await prisma.profile.update({
    where: { id: 1 },
    data: {
      capacityBudget: decOrNull(fd, "capacityBudget") ?? new Prisma.Decimal(12),
      sleepHours: decOrNull(fd, "sleep"),
      workHours: decOrNull(fd, "work"),
      commuteHours: decOrNull(fd, "commute"),
      familyHours: decOrNull(fd, "family"),
      householdHours: decOrNull(fd, "household"),
      existingHours: decOrNull(fd, "existing"),
    },
  });
  advance(fd);
}

/* ── 5 · outcomes ── */

/**
 * One outcome plus its gate items. Roles are multi-select with the first pick
 * as primary — an outcome serves several roles (CLAUDE.md), and the prototype
 * stored the full set alongside the primary.
 */
export async function addOutcome(fd: FormData) {
  const result = str(fd, "result");
  if (!result) return;

  const roleSlugs = fd.getAll("roleSlugs").map(String);
  const roles = roleSlugs.length
    ? await prisma.role.findMany({ where: { slug: { in: roleSlugs } } })
    : [];
  // Preserve the order they were picked in; the first is primary.
  const ordered = roleSlugs
    .map((s) => roles.find((r) => r.slug === s))
    .filter((r): r is (typeof roles)[number] => Boolean(r));

  const target = str(fd, "targetDate");
  const targetDate = target ? new Date(`${target}T00:00:00.000Z`) : null;

  const outcome = await prisma.outcome.create({
    data: {
      result,
      purpose: str(fd, "purpose"),
      actions: str(fd, "actions"),
      phase: (str(fd, "phase") || "EXPLORING") as never,
      primaryRoleId: ordered[0]?.id ?? null,
      // baselineDate is written once, when a target is first set (CLAUDE.md).
      targetDate,
      baselineDate: targetDate,
      weeklyHours: decOrNull(fd, "weeklyHours"),
      successCriteria: str(fd, "successCriteria"),
      killCriteria: str(fd, "killCriteria"),
      criticalPath: fd.get("criticalPath") === "on",
      roles: { create: ordered.map((r) => ({ roleId: r.id })) },
    },
  });

  // Gate items arrive as one textarea, one per line.
  const gate = str(fd, "gate")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  if (gate.length) {
    await prisma.gateItem.createMany({
      data: gate.map((text, i) => ({ outcomeId: outcome.id, text, sortOrder: i })),
    });
  }
  revalidatePath("/", "layout");
}

export async function removeOutcome(fd: FormData) {
  await prisma.outcome.delete({ where: { id: str(fd, "id") } });
  revalidatePath("/", "layout");
}

/**
 * Dependencies are a second pass — an outcome can only block another once both
 * exist, which is why this is separate from creation (the order seed.ts uses).
 * Replace-all per outcome, matching setDependencies in app/actions.ts.
 */
export async function saveDependencies(fd: FormData) {
  const outcomes = await prisma.outcome.findMany({ select: { id: true } });
  for (const { id } of outcomes) {
    const blocking = fd
      .getAll(`blockedBy-${id}`)
      .map(String)
      .filter((b) => b && b !== id); // an outcome cannot block itself
    await prisma.outcomeDependency.deleteMany({ where: { blockedId: id } });
    if (blocking.length) {
      await prisma.outcomeDependency.createMany({
        data: blocking.map((blockingId) => ({ blockedId: id, blockingId })),
        skipDuplicates: true,
      });
    }
  }
  advance(fd);
}

/* ── 6 · renewal ── */

export async function saveRenewal(fd: FormData) {
  for (const dimension of ["PHYSICAL", "MENTAL", "SPIRITUAL", "SOCIAL"] as SawDimension[]) {
    const practice = str(fd, `practice-${dimension}`);
    // An empty practice means "not this one, not yet" — skip rather than
    // creating a hollow row that then reads as a missed cadence.
    if (!practice) continue;
    const roleSlug = str(fd, `role-${dimension}`);
    const role = roleSlug ? await prisma.role.findUnique({ where: { slug: roleSlug } }) : null;
    const data = {
      practice,
      minimumViable: str(fd, `floor-${dimension}`),
      cadence: (str(fd, `cadence-${dimension}`) || null) as SawCadence | null,
      sessionMinutes: str(fd, `minutes-${dimension}`) ? Number(str(fd, `minutes-${dimension}`)) : null,
      mvMinutes: str(fd, `floorMinutes-${dimension}`)
        ? Number(str(fd, `floorMinutes-${dimension}`))
        : null,
      depletes: str(fd, `depletes-${dimension}`),
      roleId: role?.id ?? null,
      health: "GREEN" as const,
    };
    await prisma.sawPractice.upsert({
      where: { dimension },
      create: { dimension, ...data },
      update: data,
    });
  }
  advance(fd);
}

/* ── 7 · RAID and 8 · people ──
   Both steps create through the same actions the tabs use (createRaidItem,
   createPerson, addContribution, addCommitment, addPotential), so there is no
   second write path to keep in sync. These only move the flow along. */

export async function advanceStep(fd: FormData) {
  advance(fd);
}

export async function removeRaidItem(fd: FormData) {
  await prisma.raidItem.delete({ where: { id: str(fd, "id") } });
  revalidatePath("/", "layout");
}

export async function removePerson(fd: FormData) {
  await prisma.person.delete({ where: { id: str(fd, "id") } });
  revalidatePath("/", "layout");
}

/* ── 9 · done ── */

export async function finishOnboarding() {
  await ensureProfile();
  await prisma.profile.update({ where: { id: 1 }, data: { onboardedAt: todayUTC() } });
  revalidatePath("/", "layout");
  redirect("/");
}
