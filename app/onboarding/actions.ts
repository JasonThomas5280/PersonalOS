"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { SawCadence, SawDimension } from "@prisma/client";
import { toUTCDate } from "@/lib/dates";
import { prisma } from "@/lib/prisma";

function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

/**
 * One-shot first-run setup: mission + capacity, selected roles with missions,
 * an optional first outcome, and an optional renewal practice.
 * Additive and idempotent — re-running updates rather than duplicating.
 */
export async function completeOnboarding(fd: FormData) {
  await prisma.profile.upsert({
    where: { id: 1 },
    create: { id: 1, mission: str(fd, "mission"), capacityBudget: str(fd, "capacityBudget") || "12" },
    update: { mission: str(fd, "mission"), capacityBudget: str(fd, "capacityBudget") || "12" },
  });

  // Roles: checkbox set, each with an optional mission line.
  const slugs = fd.getAll("roles").map(String);
  for (const [i, slug] of slugs.entries()) {
    const label = str(fd, `label-${slug}`) || slug;
    const icon = str(fd, `icon-${slug}`) || "◈";
    const mission = str(fd, `roleMission-${slug}`);
    await prisma.role.upsert({
      where: { slug },
      create: { slug, label, icon, sortOrder: i, mission },
      update: { label, icon, ...(mission ? { mission } : {}) },
    });
  }

  // First outcome (optional). Target date sets the baseline — write once.
  const result = str(fd, "outcomeResult");
  if (result) {
    const target = str(fd, "outcomeTarget");
    const primaryRole = str(fd, "outcomeRole");
    const role = primaryRole ? await prisma.role.findUnique({ where: { slug: primaryRole } }) : null;
    const existing = await prisma.outcome.findFirst({ where: { result } });
    if (!existing) {
      await prisma.outcome.create({
        data: {
          result,
          purpose: str(fd, "outcomePurpose"),
          phase: "EXPLORING",
          primaryRoleId: role?.id ?? null,
          targetDate: target ? toUTCDate(target) : null,
          baselineDate: target ? toUTCDate(target) : null,
          weeklyHours: str(fd, "outcomeHours") || null,
          roles: role ? { create: [{ roleId: role.id }] } : undefined,
        },
      });
    }
  }

  // One renewal practice (optional).
  const dimension = str(fd, "sawDimension") as SawDimension | "";
  const practice = str(fd, "sawPractice");
  if (dimension && practice) {
    const data = {
      practice,
      minimumViable: str(fd, "sawFloor"),
      cadence: (str(fd, "sawCadence") || null) as SawCadence | null,
      sessionMinutes: str(fd, "sawMinutes") ? Number(str(fd, "sawMinutes")) : null,
      mvMinutes: str(fd, "sawFloorMinutes") ? Number(str(fd, "sawFloorMinutes")) : null,
      health: "GREEN" as const,
    };
    await prisma.sawPractice.upsert({
      where: { dimension },
      create: { dimension, ...data },
      update: data,
    });
  }

  revalidatePath("/", "layout");
  redirect("/");
}
