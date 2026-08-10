import { prisma } from "./prisma";
import { todayUTC } from "./dates";
import { computeAlerts, type Alert, type AlertsSnapshot } from "./alerts";

/** Load the database snapshot the alerts engine consumes. */
export async function loadAlertsSnapshot(now: Date = todayUTC()): Promise<AlertsSnapshot> {
  const [profile, roles, outcomes, raidItems, people, bigThreeToday, sawPractices, weeklyReviews] =
    await Promise.all([
      prisma.profile.findUnique({ where: { id: 1 } }),
      prisma.role.findMany({
        select: { id: true, label: true, reviewCadence: true, lastReviewed: true },
      }),
      prisma.outcome.findMany({
        select: {
          id: true,
          result: true,
          phase: true,
          baselineDate: true,
          targetDate: true,
          actualDate: true,
          leadTimeDays: true,
          weeklyHours: true,
          criticalPath: true,
        },
      }),
      prisma.raidItem.findMany({
        select: {
          id: true,
          type: true,
          status: true,
          description: true,
          due: true,
          severity: true,
          probability: true,
        },
      }),
      prisma.person.findMany({
        select: {
          id: true,
          name: true,
          ring: true,
          lastContact: true,
          cadenceDays: true,
          given: { select: { date: true } },
          owed: { select: { text: true, due: true, done: true } },
        },
      }),
      prisma.bigThreeItem.findMany({
        where: { date: now },
        select: { slot: true, text: true, quadrant: true },
      }),
      prisma.sawPractice.findMany({
        select: {
          id: true,
          dimension: true,
          cadence: true,
          sessions: { select: { date: true } },
        },
      }),
      prisma.weeklyReview.findMany({ select: { weekStart: true } }),
    ]);

  return {
    now,
    profile,
    roles,
    outcomes,
    raidItems,
    people,
    bigThreeToday,
    sawPractices,
    weeklyReviews,
  };
}

export async function loadAlerts(now: Date = todayUTC()): Promise<Alert[]> {
  return computeAlerts(await loadAlertsSnapshot(now));
}
